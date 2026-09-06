// Package h2hr provides the server-only client for Pulsa24Jam H2HR.
package h2hr

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const DefaultURL = "https://api.pulsa24jam.net/v2/trx"

type Config struct {
	URL     string
	APIKey  string
	PIN     string
	Enabled bool
}

func ConfigFromEnv() Config {
	url := strings.TrimSpace(os.Getenv("PULSA24JAM_H2HR_URL"))
	if url == "" {
		url = DefaultURL
	}
	return Config{URL: url, APIKey: strings.TrimSpace(os.Getenv("PULSA24JAM_H2HR_API_KEY")), PIN: strings.TrimSpace(os.Getenv("PULSA24JAM_H2HR_PIN")), Enabled: os.Getenv("PULSA24JAM_H2HR_ENABLED") == "true"}
}

func (c Config) Ready() bool { return c.Enabled && c.URL != "" && c.APIKey != "" && c.PIN != "" }

type Client struct {
	config Config
	http   *http.Client
}

func New(config Config) *Client {
	return &Client{config: config, http: &http.Client{Timeout: 20 * time.Second}}
}

type Request struct {
	Commands string `json:"commands"`
	Product  string `json:"product,omitempty"`
	Dest     string `json:"dest,omitempty"`
	Qty      int64  `json:"qty,omitempty"`
	RefID    string `json:"refid,omitempty"`
	PIN      string `json:"pin"`
}

type Transaction struct {
	ID       int64  `json:"id"`
	RefID    string `json:"ref_id"`
	Status   int    `json:"status"`
	Message  string `json:"keterangan"`
	Provider string `json:"provider_ref"`
	SN       string `json:"sn"`
}

type Response struct {
	OK          bool            `json:"ok"`
	Error       string          `json:"error"`
	Message     string          `json:"msg"`
	Status      int             `json:"status"`
	RefID       string          `json:"refid"`
	Existing    bool            `json:"existing"`
	Transaction Transaction     `json:"transaksi_member"`
	Items       []Product       `json:"items"`
	Raw         json.RawMessage `json:"-"`
}

type Product struct {
	ID            int64  `json:"id"`
	SKU           string `json:"sku"`
	Name          string `json:"nama"`
	Group         string `json:"group_name"`
	Category      string `json:"kategori_nama"`
	Brand         string `json:"brand_nama"`
	PriceType     string `json:"tipe_harga"`
	Price         int64  `json:"harga"`
	AdditionalFee int64  `json:"fee_tambahan"`
}

func (c *Client) Call(ctx context.Context, request Request) (Response, error) {
	if !c.config.Ready() {
		return Response{}, errors.New("integrasi H2HR belum diaktifkan")
	}
	request.Commands = strings.ToUpper(strings.TrimSpace(request.Commands))
	request.PIN = c.config.PIN
	if request.Commands == "" {
		return Response{}, errors.New("command H2HR wajib diisi")
	}
	if len(request.RefID) > 30 {
		return Response{}, errors.New("refid maksimal 30 byte")
	}
	body, err := json.Marshal(request)
	if err != nil {
		return Response{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.URL, bytes.NewReader(body))
	if err != nil {
		return Response{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Api-Key", c.config.APIKey)
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return Response{}, fmt.Errorf("menghubungi H2HR: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Response{}, err
	}
	var out Response
	if err := json.Unmarshal(raw, &out); err != nil {
		return Response{}, fmt.Errorf("respons H2HR tidak valid: %w", err)
	}
	out.Raw = raw
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return out, fmt.Errorf("H2HR HTTP %d: %s", resp.StatusCode, first(out.Error, out.Message))
	}
	if !out.OK {
		return out, errors.New(first(out.Error, out.Message, "H2HR menolak request"))
	}
	return out, nil
}

func first(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
