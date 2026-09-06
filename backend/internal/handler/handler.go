package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"antarapulsa/backend/internal/auth"
	"antarapulsa/backend/internal/store"
)

type Handler struct {
	store    *store.Store
	sessions *auth.SessionManager
}

func New(st *store.Store, sessions *auth.SessionManager) *Handler {
	return &Handler{store: st, sessions: sessions}
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", h.login)
	mux.HandleFunc("POST /api/logout", h.logout)
	mux.HandleFunc("GET /api/me", h.withAuth(h.me))
	mux.HandleFunc("PATCH /api/me", h.withAuth(h.updateMe))
	mux.HandleFunc("GET /api/products", h.withAuth(h.products))
	mux.HandleFunc("GET /api/transactions", h.withAuth(h.transactions))
	mux.HandleFunc("POST /api/purchase", h.withAuth(h.purchase))
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		respond(w, 200, map[string]string{"status": "ok", "service": "antarapulsa-api"})
	})
	return securityHeaders(mux)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
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
func (h *Handler) purchase(w http.ResponseWriter, r *http.Request, id int64) {
	var in struct{ ProductID, Target string }
	if decode(r, &in) != nil {
		respond(w, 400, map[string]string{"error": "Data tidak valid"})
		return
	}
	tx, err := h.store.Purchase(id, in.ProductID, strings.TrimSpace(in.Target))
	if err != nil {
		respond(w, 400, map[string]string{"error": err.Error()})
		return
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
