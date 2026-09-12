package store

import "testing"

func TestCreateDownlineCanAuthenticate(t *testing.T) {
	s := New()
	u, err := s.CreateDownline(1, "User Baru", "userbaru", "user@example.com", "rahasia123", "Member")
	if err != nil {
		t.Fatal(err)
	}
	if u.ParentID != 1 || u.Level != "Member" {
		t.Fatalf("unexpected downline: %+v", u)
	}
	loggedIn, ok := s.Authenticate("userbaru", "rahasia123")
	if !ok || loggedIn.ID != u.ID {
		t.Fatal("new downline cannot authenticate")
	}
	if got := s.Downlines(1); len(got) != 1 || got[0].ID != u.ID {
		t.Fatalf("unexpected downlines: %+v", got)
	}
}

func TestPurchaseDeductsBalance(t *testing.T) {
	s := New()
	// Saldo hanya disiapkan untuk skenario test; akun baru di aplikasi tetap Rp0.
	s.users[1].Balance = 100_000
	before, _ := s.User(1)
	tx, err := s.Purchase(1, "tsel-10", "081299999999")
	if err != nil {
		t.Fatal(err)
	}
	after, _ := s.User(1)
	if after.Balance != before.Balance-tx.Amount {
		t.Fatalf("saldo tidak sesuai: %d", after.Balance)
	}
	if tx.Status != "Berhasil" {
		t.Fatalf("status: %s", tx.Status)
	}
}

func TestAuthentication(t *testing.T) {
	s := New()
	if _, ok := s.Authenticate("081234567890", "pulsa123"); !ok {
		t.Fatal("akun demo seharusnya valid")
	}
	if _, ok := s.Authenticate("081234567890", "salah"); ok {
		t.Fatal("password salah tidak boleh valid")
	}
}
