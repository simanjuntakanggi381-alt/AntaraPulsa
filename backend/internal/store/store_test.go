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

func TestCreditApplicationVisibleToMarketingAndOperator(t *testing.T) {
	s := New()
	marketing, err := s.CreateDownline(1, "Marketing", "marketing-test", "marketing@test.id", "secret12", "Marketing")
	if err != nil {
		t.Fatal(err)
	}
	agent, err := s.CreateDownline(marketing.ID, "Agent", "agent-test", "agent@test.id", "secret12", "Agent")
	if err != nil {
		t.Fatal(err)
	}
	item, err := s.CreateCreditApplication(agent.ID, map[string]any{"id": "KSA-TEST", "amount": 500000})
	if err != nil {
		t.Fatal(err)
	}
	if item["status"] != "Pending" {
		t.Fatalf("status: %v", item["status"])
	}
	if got := s.CreditApplications(marketing.ID, "Marketing"); len(got) != 1 {
		t.Fatalf("marketing got %d", len(got))
	}
	if got := s.CreditApplications(999, "Operator"); len(got) != 1 {
		t.Fatalf("operator got %d", len(got))
	}
	if err = s.UpdateCreditApplicationStatus("KSA-TEST", "Aktif"); err != nil {
		t.Fatal(err)
	}
	if got := s.CreditApplications(agent.ID, "Agent"); got[0]["status"] != "Aktif" {
		t.Fatalf("agent status: %v", got[0]["status"])
	}
}
