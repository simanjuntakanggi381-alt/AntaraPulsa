package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]int64
	states   map[string]time.Time
	secure   bool
}

func New(secure bool) *SessionManager {
	return &SessionManager{sessions: map[string]int64{}, states: map[string]time.Time{}, secure: secure}
}

func (s *SessionManager) Create(w http.ResponseWriter, userID int64) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)
	s.mu.Lock()
	s.sessions[token] = userID
	s.mu.Unlock()
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
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.sessions[c.Value]
	return id, ok
}

func (s *SessionManager) Destroy(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("antara_session"); err == nil {
		s.mu.Lock()
		delete(s.sessions, c.Value)
		s.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{Name: "antara_session", Value: "", Path: "/", MaxAge: -1, Expires: time.Unix(0, 0), HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode})
}
