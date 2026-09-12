package model

import "time"

type User struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Password string `json:"-"`
	Balance  int64  `json:"balance"`
	Level    string `json:"level"`
	ParentID int64  `json:"parent_id,omitempty"`
}

type Transaction struct {
	ID        string    `json:"id"`
	UserID    int64     `json:"-"`
	Type      string    `json:"type"`
	Provider  string    `json:"provider"`
	Product   string    `json:"product"`
	Target    string    `json:"target"`
	Amount    int64     `json:"amount"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type InactiveCounter struct {
	ID              int64      `json:"id"`
	Name            string     `json:"name"`
	Phone           string     `json:"phone"`
	Email           string     `json:"email"`
	Level           string     `json:"level"`
	Balance         int64      `json:"balance"`
	LastTransaction *time.Time `json:"last_transaction,omitempty"`
	InactiveDays    int        `json:"inactive_days"`
}

type Product struct {
	ID        string `json:"id"`
	Provider  string `json:"provider"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	Price     int64  `json:"price"`
	Color     string `json:"color"`
	PriceType string `json:"price_type"`
	Fee       int64  `json:"fee"`
}
