package handler

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"antarapulsa/backend/internal/auth"
	"antarapulsa/backend/internal/h2hr"
	"antarapulsa/backend/internal/store"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type Handler struct {
	store      *store.Store
	sessions   *auth.SessionManager
	google     googleOAuth
	h2hr       *h2hr.Client
	h2hrConfig h2hr.Config
}

type googleOAuth struct{ clientID, clientSecret, redirectURL string }

func New(st *store.Store, sessions *auth.SessionManager) *Handler {
	config := h2hr.ConfigFromEnv()
	return &Handler{store: st, sessions: sessions, google: googleOAuth{clientID: os.Getenv("GOOGLE_CLIENT_ID"), clientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"), redirectURL: os.Getenv("GOOGLE_REDIRECT_URL")}, h2hr: h2hr.New(config), h2hrConfig: config}
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", h.login)
	mux.HandleFunc("POST /api/logout", h.logout)
	mux.HandleFunc("GET /api/auth/google/login", h.googleLogin)
	mux.HandleFunc("GET /api/auth/google/callback", h.googleCallback)
	mux.HandleFunc("GET /api/me", h.withAuth(h.me))
	mux.HandleFunc("PATCH /api/me", h.withAuth(h.updateMe))
	mux.HandleFunc("GET /api/products", h.withAuth(h.products))
	mux.HandleFunc("GET /api/transactions", h.withAuth(h.transactions))
	mux.HandleFunc("GET /api/downlines", h.withAuth(h.downlines))
	mux.HandleFunc("POST /api/downlines", h.withAuth(h.createDownline))
	mux.HandleFunc("GET /api/h2hr/saldo", h.withAuth(h.h2hrSaldo))
	mux.HandleFunc("GET /api/h2hr/products", h.withAuth(h.h2hrProducts))
	mux.HandleFunc("POST /api/h2hr/callback/{token}", h.h2hrCallback)
	mux.HandleFunc("GET /api/v1/webhooks/pulsa24jam", h.h2hrWebhook)
	mux.HandleFunc("POST /api/v1/webhooks/pulsa24jam", h.h2hrWebhook)
	mux.HandleFunc("POST /api/purchase", h.withAuth(h.purchase))
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		respond(w, 200, map[string]string{"status": "ok", "service": "antarapulsa-api"})
	})
	return securityHeaders(mux)
}

func (h *Handler) h2hrWebhook(w http.ResponseWriter, r *http.Request) {
	if h.h2hrConfig.CallbackToken == "" {
		http.NotFound(w, r)
		return
	}

	var callback struct {
		RefID   string `json:"refid"`
		Status  string `json:"status"`
		Message string `json:"message"`
		Key     string `json:"key"`
	}
	var payload []byte
	var err error
	if r.Method == http.MethodGet {
		callback.RefID = firstNonEmpty(r.URL.Query().Get("refid"), r.URL.Query().Get("ref_id"))
		callback.Status = r.URL.Query().Get("status")
		callback.Message = firstNonEmpty(r.URL.Query().Get("message"), r.URL.Query().Get("msg"))
		callback.Key = r.URL.Query().Get("key")
		payload, err = json.Marshal(r.URL.Query())
	} else {
		payload, err = io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err == nil {
			err = json.Unmarshal(payload, &callback)
		}
	}
	if err != nil {
		http.Error(w, "payload tidak valid", http.StatusBadRequest)
		return
	}

	providedKey := strings.TrimPrefix(firstNonEmpty(callback.Key, r.URL.Query().Get("key"), r.Header.Get("X-Webhook-Token"), r.Header.Get("X-Callback-Token")), "Bearer ")
	if providedKey != "" && subtle.ConstantTimeCompare([]byte(providedKey), []byte(h.h2hrConfig.CallbackToken)) != 1 {
		http.NotFound(w, r)
		return
	}
	callback.RefID = strings.TrimSpace(callback.RefID)
	if callback.RefID == "" {
		http.Error(w, "refid wajib diisi", http.StatusBadRequest)
		return
	}
	status := normalizeH2HRStatus(firstNonEmpty(callback.Status, callback.Message))
	if err := h.store.ResolveH2HRPurchase(callback.RefID, status); err != nil {
		http.Error(w, "refid transaksi tidak dikenal", http.StatusNotFound)
		return
	}
	if err := h.store.RecordH2HRCallback(callback.RefID, status, payload); err != nil {
		http.Error(w, "callback tidak dapat disimpan", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("OK"))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func normalizeH2HRStatus(value string) string {
	upper := strings.ToUpper(strings.TrimSpace(value))
	switch {
	case strings.Contains(upper, "SUKSES"), strings.Contains(upper, "SUCCESS"):
		return "success"
	case strings.Contains(upper, "GAGAL"), strings.Contains(upper, "FAILED"), strings.Contains(upper, "FAILURE"):
		return "failed"
	case strings.Contains(upper, "PENDING"), strings.Contains(upper, "PROSES"), strings.Contains(upper, "PROCESS"):
		return "pending"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func (h *Handler) h2hrCallback(w http.ResponseWriter, r *http.Request) {
	if h.h2hrConfig.CallbackToken == "" || r.PathValue("token") != h.h2hrConfig.CallbackToken {
		http.NotFound(w, r)
		return
	}
	payload, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "payload tidak dapat dibaca", http.StatusBadRequest)
		return
	}
	var callback struct {
		RefID  string `json:"refid"`
		Status string `json:"status"`
	}
	if err = json.Unmarshal(payload, &callback); err != nil || strings.TrimSpace(callback.RefID) == "" {
		http.Error(w, "callback tidak valid", http.StatusBadRequest)
		return
	}
	if err = h.store.ResolveH2HRPurchase(strings.TrimSpace(callback.RefID), callback.Status); err != nil {
		http.Error(w, "refid transaksi tidak dikenal", http.StatusNotFound)
		return
	}
	if err = h.store.RecordH2HRCallback(callback.RefID, callback.Status, payload); err != nil {
		http.Error(w, "callback tidak dapat disimpan", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) h2hrSaldo(w http.ResponseWriter, r *http.Request, _ int64) {
	result, err := h.h2hr.Call(r.Context(), h2hr.Request{Commands: "SALDO"})
	if err != nil {
		respond(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	respond(w, http.StatusOK, result)
}

func (h *Handler) h2hrProducts(w http.ResponseWriter, r *http.Request, _ int64) {
	result, err := h.h2hr.Call(r.Context(), h2hr.Request{Commands: "PRODUK", Product: strings.TrimSpace(r.URL.Query().Get("product"))})
	if err != nil {
		respond(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	respond(w, http.StatusOK, result)
}

func (h *Handler) googleEnabled() bool {
	return h.google.clientID != "" && h.google.clientSecret != "" && h.google.redirectURL != ""
}

func (h *Handler) googleLogin(w http.ResponseWriter, r *http.Request) {
	if !h.googleEnabled() {
		http.Error(w, "Google Login belum dikonfigurasi", http.StatusServiceUnavailable)
		return
	}
	state := h.sessions.CreateOAuthState(w)
	q := url.Values{"client_id": {h.google.clientID}, "redirect_uri": {h.google.redirectURL}, "response_type": {"code"}, "scope": {"openid email profile"}, "state": {state}, "prompt": {"select_account"}}
	http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+q.Encode(), http.StatusFound)
}

func (h *Handler) googleCallback(w http.ResponseWriter, r *http.Request) {
	if !h.googleEnabled() || !h.sessions.ConsumeOAuthState(w, r, r.URL.Query().Get("state")) {
		http.Error(w, "Login Google tidak valid atau telah kedaluwarsa", http.StatusBadRequest)
		return
	}
	if errCode := r.URL.Query().Get("error"); errCode != "" {
		http.Error(w, "Login Google dibatalkan: "+errCode, http.StatusUnauthorized)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		http.Error(w, "Tidak dapat terhubung ke Google", http.StatusBadGateway)
		return
	}
	config := oauth2.Config{ClientID: h.google.clientID, ClientSecret: h.google.clientSecret, RedirectURL: h.google.redirectURL, Endpoint: provider.Endpoint(), Scopes: []string{oidc.ScopeOpenID, "email", "profile"}}
	token, err := config.Exchange(ctx, r.URL.Query().Get("code"))
	if err != nil {
		http.Error(w, "Kode login Google tidak valid", http.StatusUnauthorized)
		return
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		http.Error(w, "Google tidak mengirim identitas akun", http.StatusUnauthorized)
		return
	}
	idToken, err := provider.Verifier(&oidc.Config{ClientID: h.google.clientID}).Verify(ctx, rawIDToken)
	if err != nil {
		http.Error(w, "Identitas Google tidak dapat diverifikasi", http.StatusUnauthorized)
		return
	}
	var claims struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
	}
	if err = idToken.Claims(&claims); err != nil || !claims.EmailVerified {
		http.Error(w, "Email Google belum terverifikasi", http.StatusUnauthorized)
		return
	}
	u, err := h.store.FindOrCreateGoogleUser(claims.Subject, claims.Name, claims.Email)
	if err != nil {
		http.Error(w, "Akun Google tidak dapat dibuat", http.StatusInternalServerError)
		return
	}
	h.sessions.Create(w, u.ID)
	http.Redirect(w, r, "/", http.StatusFound)
}

func securityHeaders(next http.Handler) http.Handler {
	allowedOrigin := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGIN"))
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:3000"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Session-aware API responses must never be cached by a browser or proxy.
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store, private")
			w.Header().Set("Vary", "Cookie")
		}
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func decode(r *http.Request, v any) error {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}

func (h *Handler) withAuth(next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := h.sessions.UserID(r)
		if !ok {
			respond(w, 401, map[string]string{"error": "Sesi berakhir, silakan masuk kembali"})
			return
		}
		next(w, r, id)
	}
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var in struct{ Phone, Password string }
	if decode(r, &in) != nil {
		respond(w, 400, map[string]string{"error": "Data tidak valid"})
		return
	}
	u, ok := h.store.Authenticate(strings.TrimSpace(in.Phone), in.Password)
	if !ok {
		respond(w, 401, map[string]string{"error": "Nomor atau kata sandi salah"})
		return
	}
	h.sessions.Create(w, u.ID)
	respond(w, 200, u)
}
func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	h.sessions.Destroy(w, r)
	respond(w, 200, map[string]bool{"ok": true})
}
func (h *Handler) me(w http.ResponseWriter, _ *http.Request, id int64) {
	u, _ := h.store.User(id)
	respond(w, 200, u)
}
func (h *Handler) products(w http.ResponseWriter, _ *http.Request, _ int64) {
	respond(w, 200, h.store.Products())
}
func (h *Handler) transactions(w http.ResponseWriter, _ *http.Request, id int64) {
	respond(w, 200, h.store.Transactions(id))
}
func (h *Handler) downlines(w http.ResponseWriter, _ *http.Request, id int64) {
	respond(w, 200, h.store.Downlines(id))
}
func (h *Handler) createDownline(w http.ResponseWriter, r *http.Request, id int64) {
	parent, ok := h.store.User(id)
	if !ok {
		respond(w, 404, map[string]string{"error": "Akun tidak ditemukan"})
		return
	}
	role := strings.ToLower(strings.TrimSpace(parent.Level))
	if role != "agent" && role != "marketing" {
		respond(w, 403, map[string]string{"error": "Akun tidak memiliki akses menambah downline"})
		return
	}
	var in struct {
		Name     string `json:"name"`
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Level    string `json:"level"`
	}
	if decode(r, &in) != nil {
		respond(w, 400, map[string]string{"error": "Data tidak valid"})
		return
	}
	level := strings.Title(strings.ToLower(strings.TrimSpace(in.Level)))
	if level == "User" {
		level = "Member"
	}
	if level != "Member" && !(role == "marketing" && level == "Agent") {
		respond(w, 403, map[string]string{"error": "Role downline tidak diizinkan"})
		return
	}
	u, err := h.store.CreateDownline(id, strings.TrimSpace(in.Name), strings.TrimSpace(in.Username), strings.TrimSpace(in.Email), in.Password, level)
	if err != nil {
		respond(w, 400, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, u)
}
func (h *Handler) purchase(w http.ResponseWriter, r *http.Request, id int64) {
	var in struct{ ProductID, Target string }
	if decode(r, &in) != nil {
		respond(w, 400, map[string]string{"error": "Data tidak valid"})
		return
	}
	if !h.h2hrConfig.Ready() {
		respond(w, http.StatusServiceUnavailable, map[string]string{"error": "Transaksi provider sedang dinonaktifkan sampai katalog tervalidasi"})
		return
	}
	tx, product, err := h.store.PrepareH2HRPurchase(id, strings.ToUpper(strings.TrimSpace(in.ProductID)), strings.TrimSpace(in.Target))
	if err != nil {
		respond(w, 400, map[string]string{"error": err.Error()})
		return
	}
	result, providerErr := h.h2hr.Call(r.Context(), h2hr.Request{Commands: "PAY", Product: product.ID, Dest: strings.TrimSpace(in.Target), Qty: 1, RefID: tx.ID})
	if providerErr != nil {
		// A body from P24 proves that the request was rejected. When no body was
		// received the outcome is ambiguous, so keep it pending for reconciliation.
		if len(result.Raw) > 0 && !result.OK {
			_ = h.store.ResolveH2HRPurchase(tx.ID, "failed")
			tx.Status = "Gagal"
			respond(w, http.StatusBadGateway, map[string]string{"error": providerErr.Error()})
			return
		}
		tx.Status = "Diproses"
		respond(w, http.StatusAccepted, tx)
		return
	}
	providerStatus := result.Transaction.Status
	if providerStatus == 0 {
		providerStatus = result.Status
	}
	_ = h.store.ResolveH2HRPurchase(tx.ID, strconv.Itoa(providerStatus))
	if providerStatus == 2 {
		tx.Status = "Berhasil"
	} else if providerStatus == 3 {
		tx.Status = "Gagal"
	} else {
		tx.Status = "Diproses"
	}
	respond(w, 201, tx)
}
func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request, id int64) {
	var in struct{ Name, Email string }
	if decode(r, &in) != nil {
		respond(w, 400, map[string]string{"error": "Data tidak valid"})
		return
	}
	u, err := h.store.UpdateProfile(id, strings.TrimSpace(in.Name), strings.TrimSpace(in.Email))
	if err != nil {
		respond(w, 400, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, u)
}
