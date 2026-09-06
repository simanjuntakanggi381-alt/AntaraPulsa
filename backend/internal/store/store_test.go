package store

import "testing"

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
