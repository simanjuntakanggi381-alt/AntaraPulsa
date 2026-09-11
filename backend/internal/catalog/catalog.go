package catalog

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"

	"antarapulsa/backend/internal/h2hr"
)

//go:embed p24_snapshot.json
var snapshotJSON []byte

// Snapshot returns the Pulsa24Jam catalogue supplied by the account owner.
// It is used when the provider's PRODUK command is available but returns an
// empty list for an otherwise valid H2HR account.
func Snapshot() ([]h2hr.Product, error) {
	var products []h2hr.Product
	raw := bytes.TrimPrefix(snapshotJSON, []byte{0xef, 0xbb, 0xbf})
	if err := json.Unmarshal(raw, &products); err != nil {
		return nil, fmt.Errorf("membaca snapshot katalog Pulsa24Jam: %w", err)
	}
	return products, nil
}
