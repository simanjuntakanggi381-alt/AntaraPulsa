package catalog

import "testing"

func TestSnapshotContainsFullH2HCatalog(t *testing.T) {
	products, err := Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if len(products) < 3000 {
		t.Fatalf("snapshot terlalu kecil: %d", len(products))
	}
	requiredProviders := map[string]bool{"Telkomsel": false, "Indosat": false, "Axis": false, "Smartfren": false}
	for _, product := range products {
		if product.SKU == "" || product.Name == "" {
			t.Fatalf("SKU tidak lengkap: %#v", product)
		}
		if _, wanted := requiredProviders[product.Brand]; wanted {
			requiredProviders[product.Brand] = true
		}
	}
	for provider, found := range requiredProviders {
		if !found {
			t.Errorf("provider %s tidak ditemukan", provider)
		}
	}
}
