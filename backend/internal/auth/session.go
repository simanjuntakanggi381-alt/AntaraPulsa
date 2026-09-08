package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type SessionManager struct {
	mu     sync.RWMutex
	states map[string]time.Time
	secure bool
	secret []byte
}

func New(secure bool, secrets ...string) *SessionManager {
	secret := ""
	if len(secrets) > 0 {
		secret = strings.TrimSpace(secrets[0])
	}
	// A configured secret keeps signed sessions valid across backend restarts.
	// A random fallback remains safe for local development, but is intentionally
	// short-lived across restarts when AUTH_SESSION_SECRET was not configured.
	if secret == "" {
		bytes := make([]byte, 32)
		_, _ = rand.Read(bytes)
		secret = hex.EncodeToString(bytes)
	}
	return &SessionManager{states: map[string]time.Time{}, secure: secure, secret: []byte(secret)}
}

func (s *SessionManager) Create(w http.ResponseWriter, userID int64) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	expiresAt := time.Now().Add(7 * 24 * time.Hour).Unix()
	payload := strconv.FormatInt(userID, 10) + "." + strconv.FormatInt(expiresAt, 10) + "." + hex.EncodeToString(b)
	token := base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + s.signature(payload)
	http.SetCookie(w, &http.Cookie{Name: "antara_session", Value: token, Path: "/", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode, MaxAge: 86400 * 7})
}

func (s *SessionManager) CreateOAuthState(w http.ResponseWriter) string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	state := hex.EncodeToString(b)
	s.mu.Lock()
	s.states[state] = time.Now().Add(10 * time.Minute)
	s.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: "antara_oauth_state", Value: state, Path: "/", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode, MaxAge: 600})
	return state
}

func (s *SessionManager) ConsumeOAuthState(w http.ResponseWriter, r *http.Request, state string) bool {
	cookie, err := r.Cookie("antara_oauth_state")
	if err != nil || cookie.Value != state || state == "" {
		return false
	}
	s.mu.Lock()
	expiresAt, ok := s.states[state]
	delete(s.states, state)
	s.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: "antara_oauth_state", Value: "", Path: "/", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(0, 0)})
	return ok && time.Now().Before(expiresAt)
}

func (s *SessionManager) UserID(r *http.Request) (int64, bool) {
	c, err := r.Cookie("antara_session")
	if err != nil {
		return 0, false
	}
	parts := strings.Split(c.Value, ".")
	if len(parts) != 2 {
		return 0, false
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || !hmac.Equal([]byte(parts[1]), []byte(s.signature(string(payloadBytes)))) {
		return 0, false
	}
	payload := strings.Split(string(payloadBytes), ".")
	if len(payload) != 3 {
		return 0, false
	}
	id, idErr := strconv.ParseInt(payload[0], 10, 64)
	expiresAt, expiresErr := strconv.ParseInt(payload[1], 10, 64)
	if idErr != nil || expiresErr != nil || id < 1 || time.Now().Unix() > expiresAt {
		return 0, false
	}
	return id, true
}

func (s *SessionManager) Destroy(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "antara_session", Value: "", Path: "/", MaxAge: -1, Expires: time.Unix(0, 0), HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode})
}

func (s *SessionManager) signature(payload string) string {
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}
