package store

import (
	"antarapulsa/backend/internal/model"
	"context"
	"database/sql"
	"errors"
	"fmt"
	_ "github.com/jackc/pgx/v5/stdlib"
	"sort"
	"strings"
	"sync"
	"time"
)

// Store uses PostgreSQL in production; New remains a deterministic test store.
type Store struct {
	db           *sql.DB
	mu           sync.RWMutex
	users        map[int64]*model.User
	byPhone      map[string]int64
	byGoogle     map[string]int64
	transactions []model.Transaction
	products     []model.Product
}

func New() *Store {
	s := &Store{users: map[int64]*model.User{}, byPhone: map[string]int64{}, byGoogle: map[string]int64{}, products: seedProducts()}
	// Akun awal tidak diberi saldo contoh. Saldo hanya bertambah melalui top up
	// atau data yang benar-benar tersimpan dari transaksi.
	u := &model.User{ID: 1, Name: "Mikael Putra", Phone: "081234567890", Email: "mikael@antarapulsa.id", Password: "pulsa123", Balance: 0, Level: "Gold Partner"}
	s.users[u.ID], s.byPhone[u.Phone] = u, u.ID
	return s
}
func NewPostgres(ctx context.Context, url string) (*Store, error) {
	if url == "" {
		return nil, errors.New("DATABASE_URL belum diatur")
	}
	db, err := sql.Open("pgx", url)
	if err != nil {
		return nil, err
	}
	if err = db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("menghubungkan PostgreSQL: %w", err)
	}
	s := &Store{db: db}
	if err = s.migrate(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}
func (s *Store) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
func (s *Store) migrate(ctx context.Context) error {
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, email TEXT NOT NULL, password TEXT NOT NULL, balance BIGINT NOT NULL DEFAULT 0, level TEXT NOT NULL, google_sub TEXT UNIQUE)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE`,
		`CREATE SEQUENCE IF NOT EXISTS users_id_seq`,
		`SELECT setval('users_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM users), 0), 1), true)`,
		`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, provider TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, price BIGINT NOT NULL, color TEXT NOT NULL)`,
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'FIXED'`,
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS fee BIGINT NOT NULL DEFAULT 0`,
		`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), type TEXT NOT NULL, provider TEXT NOT NULL, product TEXT NOT NULL, target TEXT NOT NULL, amount BIGINT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions (user_id, created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS h2hr_callbacks (refid TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT '', payload JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
	} {
		if _, err := s.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("migrasi database: %w", err)
		}
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO users (id,name,phone,email,password,balance,level) VALUES (1,'Mikael Putra','081234567890','mikael@antarapulsa.id','pulsa123',0,'Gold Partner') ON CONFLICT (id) DO NOTHING`); err != nil {
		return err
	}
	for _, p := range seedProducts() {
		if _, err := s.db.ExecContext(ctx, `INSERT INTO products (id,provider,name,type,price,color,price_type,fee) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`, p.ID, p.Provider, p.Name, p.Type, p.Price, p.Color, p.PriceType, p.Fee); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) RecordH2HRCallback(refID, status string, payload []byte) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.Exec(`INSERT INTO h2hr_callbacks (refid,status,payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT (refid) DO UPDATE SET status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=NOW()`, refID, status, string(payload))
	return err
}

// FindOrCreateGoogleUser returns the account tied to Google's immutable subject.
func (s *Store) FindOrCreateGoogleUser(googleSub, name, email string) (*model.User, error) {
	if googleSub == "" || email == "" {
		return nil, errors.New("data akun Google tidak lengkap")
	}
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	phone := "google:" + googleSub
	if s.db != nil {
		u := &model.User{}
		err := s.db.QueryRow(`INSERT INTO users (id,name,phone,email,password,balance,level,google_sub) VALUES (nextval('users_id_seq'),$1,$2,$3,'',0,'Member',$4) ON CONFLICT (google_sub) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email RETURNING id,name,phone,email,password,balance,level`, name, phone, email, googleSub).Scan(&u.ID, &u.Name, &u.Phone, &u.Email, &u.Password, &u.Balance, &u.Level)
		return u, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if id, ok := s.byGoogle[googleSub]; ok {
		u := s.users[id]
		u.Name, u.Email = name, email
		copy := *u
		return &copy, nil
	}
	var id int64 = 1
	for used := true; used; id++ {
		_, used = s.users[id]
	}
	u := &model.User{ID: id, Name: name, Phone: phone, Email: email, Balance: 0, Level: "Member"}
	s.users[id], s.byPhone[phone], s.byGoogle[googleSub] = u, id, id
	copy := *u
	return &copy, nil
}

func seedProducts() []model.Product {
	return []model.Product{
		{ID: "tsel-10", Provider: "Telkomsel", Name: "Pulsa 10.000", Type: "Pulsa", Price: 11200, Color: "#ef3340", PriceType: "FIXED"},
		{ID: "tsel-50", Provider: "Telkomsel", Name: "Pulsa 50.000", Type: "Pulsa", Price: 50200, Color: "#ef3340", PriceType: "FIXED"},
		{ID: "tsel-100", Provider: "Telkomsel", Name: "Pulsa 100.000", Type: "Pulsa", Price: 98500, Color: "#ef3340", PriceType: "FIXED"},
		{ID: "isat-25gb", Provider: "Indosat", Name: "Freedom 25 GB", Type: "Paket Data", Price: 62500, Color: "#f6c700", PriceType: "FIXED"},
		{ID: "xl-15gb", Provider: "XL", Name: "Xtra Combo 15 GB", Type: "Paket Data", Price: 54750, Color: "#2f49d1", PriceType: "FIXED"},
		{ID: "tri-20gb", Provider: "Tri", Name: "Happy 20 GB", Type: "Paket Data", Price: 48900, Color: "#ff6b35", PriceType: "FIXED"},
		{ID: "pln-100", Provider: "PLN", Name: "Token 100.000", Type: "Token PLN", Price: 101500, Color: "#19a7ce", PriceType: "FIXED"},
		{ID: "pln-200", Provider: "PLN", Name: "Token 200.000", Type: "Token PLN", Price: 201500, Color: "#19a7ce", PriceType: "FIXED"},
	}
}
func (s *Store) Authenticate(phone, password string) (*model.User, bool) {
	if s.db != nil {
		u := &model.User{}
		err := s.db.QueryRow(`SELECT id,name,phone,email,password,balance,level FROM users WHERE phone=$1 AND password=$2`, phone, password).Scan(&u.ID, &u.Name, &u.Phone, &u.Email, &u.Password, &u.Balance, &u.Level)
		return u, err == nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.byPhone[phone]
	if !ok || s.users[id].Password != password {
		return nil, false
	}
	u := *s.users[id]
	return &u, true
}
func (s *Store) User(id int64) (*model.User, bool) {
	if s.db != nil {
		u := &model.User{}
		err := s.db.QueryRow(`SELECT id,name,phone,email,password,balance,level FROM users WHERE id=$1`, id).Scan(&u.ID, &u.Name, &u.Phone, &u.Email, &u.Password, &u.Balance, &u.Level)
		return u, err == nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	if !ok {
		return nil, false
	}
	o := *u
	return &o, true
}
func (s *Store) Products() []model.Product {
	if s.db != nil {
		rows, err := s.db.Query(`SELECT id,provider,name,type,price,color,price_type,fee FROM products ORDER BY id`)
		if err != nil {
			return nil
		}
		defer rows.Close()
		var out []model.Product
		for rows.Next() {
			var p model.Product
			if rows.Scan(&p.ID, &p.Provider, &p.Name, &p.Type, &p.Price, &p.Color, &p.PriceType, &p.Fee) == nil {
				out = append(out, p)
			}
		}
		return out
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]model.Product(nil), s.products...)
}

func (s *Store) Product(id string) (model.Product, bool) {
	if s.db != nil {
		var p model.Product
		err := s.db.QueryRow(`SELECT id,provider,name,type,price,color,price_type,fee FROM products WHERE id=$1`, id).Scan(&p.ID, &p.Provider, &p.Name, &p.Type, &p.Price, &p.Color, &p.PriceType, &p.Fee)
		return p, err == nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.products {
		if p.ID == id {
			return p, true
		}
	}
	return model.Product{}, false
}

// PrepareH2HRPurchase reserves the member balance and persists a pending
// transaction before any request is sent to the upstream provider.
func (s *Store) PrepareH2HRPurchase(uid int64, pid, target string) (*model.Transaction, model.Product, error) {
	p, ok := s.Product(pid)
	if !ok {
		return nil, p, errors.New("produk tidak ditemukan")
	}
	if target == "" {
		return nil, p, errors.New("nomor tujuan wajib diisi")
	}
	if p.PriceType == "OPEN_AMOUNT" {
		return nil, p, errors.New("produk nominal bebas belum dapat dibeli")
	}
	if s.db == nil {
		return nil, p, errors.New("transaksi H2HR memerlukan PostgreSQL")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return nil, p, err
	}
	defer tx.Rollback()
	r, err := tx.Exec(`UPDATE users SET balance=balance-$1 WHERE id=$2 AND balance >= $1`, p.Price, uid)
	if err != nil {
		return nil, p, err
	}
	n, _ := r.RowsAffected()
	if n == 0 {
		return nil, p, errors.New("saldo tidak cukup atau akun tidak ditemukan")
	}
	x := &model.Transaction{ID: fmt.Sprintf("AP-%d", time.Now().UnixNano()), UserID: uid, Type: p.Type, Provider: p.Provider, Product: p.Name, Target: target, Amount: p.Price, Status: "Diproses", CreatedAt: time.Now()}
	if _, err = tx.Exec(`INSERT INTO transactions (id,user_id,type,provider,product,target,amount,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, x.ID, x.UserID, x.Type, x.Provider, x.Product, x.Target, x.Amount, x.Status, x.CreatedAt); err != nil {
		return nil, p, err
	}
	return x, p, tx.Commit()
}

// ResolveH2HRPurchase applies a final provider result exactly once. A failed
// purchase refunds the balance in the same database transaction.
func (s *Store) ResolveH2HRPurchase(refID, status string) error {
	if s.db == nil {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var uid, amount int64
	var current string
	if err = tx.QueryRow(`SELECT user_id,amount,status FROM transactions WHERE id=$1 FOR UPDATE`, refID).Scan(&uid, &amount, &current); err != nil {
		return err
	}
	if current == "Berhasil" || current == "Gagal" {
		return tx.Commit()
	}
	switch normalizePurchaseStatus(status) {
	case "Berhasil":
		_, err = tx.Exec(`UPDATE transactions SET status='Berhasil' WHERE id=$1`, refID)
	case "Gagal":
		if _, err = tx.Exec(`UPDATE users SET balance=balance+$1 WHERE id=$2`, amount, uid); err == nil {
			_, err = tx.Exec(`UPDATE transactions SET status='Gagal' WHERE id=$1`, refID)
		}
	default:
		_, err = tx.Exec(`UPDATE transactions SET status='Diproses' WHERE id=$1`, refID)
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

func normalizePurchaseStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "2" || strings.Contains(status, "success") || strings.Contains(status, "sukses") {
		return "Berhasil"
	}
	if status == "3" || strings.Contains(status, "failed") || strings.Contains(status, "gagal") {
		return "Gagal"
	}
	return "Diproses"
}

// ReplaceProducts atomically refreshes the display catalog from the active provider catalog.
func (s *Store) ReplaceProducts(products []model.Product) error {
	if s.db != nil {
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if _, err = tx.Exec(`DELETE FROM products`); err != nil {
			return err
		}
		for _, product := range products {
			if _, err = tx.Exec(`INSERT INTO products (id,provider,name,type,price,color,price_type,fee) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, product.ID, product.Provider, product.Name, product.Type, product.Price, product.Color, product.PriceType, product.Fee); err != nil {
				return err
			}
		}
		return tx.Commit()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.products = append([]model.Product(nil), products...)
	return nil
}
func (s *Store) Transactions(uid int64) []model.Transaction {
	if s.db != nil {
		rows, err := s.db.Query(`SELECT id,user_id,type,provider,product,target,amount,status,created_at FROM transactions WHERE user_id=$1 ORDER BY created_at DESC`, uid)
		if err != nil {
			return nil
		}
		defer rows.Close()
		out := make([]model.Transaction, 0)
		for rows.Next() {
			var x model.Transaction
			if rows.Scan(&x.ID, &x.UserID, &x.Type, &x.Provider, &x.Product, &x.Target, &x.Amount, &x.Status, &x.CreatedAt) == nil {
				out = append(out, x)
			}
		}
		return out
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Transaction, 0)
	for _, x := range s.transactions {
		if x.UserID == uid {
			out = append(out, x)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}
func (s *Store) Purchase(uid int64, pid, target string) (*model.Transaction, error) {
	if target == "" {
		return nil, errors.New("nomor tujuan wajib diisi")
	}
	if s.db != nil {
		return s.purchasePG(uid, pid, target)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[uid]
	if !ok {
		return nil, errors.New("akun tidak ditemukan")
	}
	var p *model.Product
	for i := range s.products {
		if s.products[i].ID == pid {
			p = &s.products[i]
		}
	}
	if p == nil {
		return nil, errors.New("produk tidak ditemukan")
	}
	if p.PriceType == "OPEN_AMOUNT" {
		return nil, errors.New("produk nominal bebas belum dapat dibeli")
	}
	if u.Balance < p.Price {
		return nil, errors.New("saldo tidak cukup")
	}
	u.Balance -= p.Price
	x := model.Transaction{ID: fmt.Sprintf("AP-%d", time.Now().UnixNano()), UserID: uid, Type: p.Type, Provider: p.Provider, Product: p.Name, Target: target, Amount: p.Price, Status: "Berhasil", CreatedAt: time.Now()}
	s.transactions = append(s.transactions, x)
	return &x, nil
}
func (s *Store) purchasePG(uid int64, pid, target string) (*model.Transaction, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var p model.Product
	if err = tx.QueryRow(`SELECT id,provider,name,type,price,color,price_type,fee FROM products WHERE id=$1`, pid).Scan(&p.ID, &p.Provider, &p.Name, &p.Type, &p.Price, &p.Color, &p.PriceType, &p.Fee); err == sql.ErrNoRows {
		return nil, errors.New("produk tidak ditemukan")
	} else if err != nil {
		return nil, err
	}
	if p.PriceType == "OPEN_AMOUNT" {
		return nil, errors.New("produk nominal bebas belum dapat dibeli")
	}
	r, err := tx.Exec(`UPDATE users SET balance=balance-$1 WHERE id=$2 AND balance >= $1`, p.Price, uid)
	if err != nil {
		return nil, err
	}
	n, _ := r.RowsAffected()
	if n == 0 {
		return nil, errors.New("saldo tidak cukup atau akun tidak ditemukan")
	}
	x := &model.Transaction{ID: fmt.Sprintf("AP-%d", time.Now().UnixNano()), UserID: uid, Type: p.Type, Provider: p.Provider, Product: p.Name, Target: target, Amount: p.Price, Status: "Berhasil", CreatedAt: time.Now()}
	if _, err = tx.Exec(`INSERT INTO transactions (id,user_id,type,provider,product,target,amount,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, x.ID, x.UserID, x.Type, x.Provider, x.Product, x.Target, x.Amount, x.Status, x.CreatedAt); err != nil {
		return nil, err
	}
	return x, tx.Commit()
}
func (s *Store) UpdateProfile(id int64, name, email string) (*model.User, error) {
	if s.db != nil {
		u := &model.User{}
		err := s.db.QueryRow(`UPDATE users SET name=CASE WHEN $1='' THEN name ELSE $1 END,email=CASE WHEN $2='' THEN email ELSE $2 END WHERE id=$3 RETURNING id,name,phone,email,password,balance,level`, name, email, id).Scan(&u.ID, &u.Name, &u.Phone, &u.Email, &u.Password, &u.Balance, &u.Level)
		if err == sql.ErrNoRows {
			return nil, errors.New("akun tidak ditemukan")
		}
		return u, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return nil, errors.New("akun tidak ditemukan")
	}
	if name != "" {
		u.Name = name
	}
	if email != "" {
		u.Email = email
	}
	o := *u
	return &o, nil
}
