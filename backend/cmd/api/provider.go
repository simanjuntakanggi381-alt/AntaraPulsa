package main

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	leadingCode = regexp.MustCompile(`^\s*\d+\s*[-.]?\s*`)
	amountTail  = regexp.MustCompile(`(?i)\s+(?:RP\s*)?\d[\d.]*\s*(?:K|RIBU|ELEKTRIK(?:\s*\d+)?)?\s*$`)
	feeTail     = regexp.MustCompile(`(?i)\s+(?:ADMIN|DENDA|NON\s+AIR|CEK\s+TAGIHAN)\b.*$`)
)

type providerAlias struct {
	name    string
	aliases []string
}

var bankAliases = []providerAlias{
	{"Allo Bank", []string{"ALLO BANK"}}, {"Bank Aceh", []string{"BANK ACEH"}},
	{"Bank Aladin Syariah", []string{"ALADIN"}}, {"Bank Artha Graha", []string{"ARTHA GRAHA"}},
	{"Bank Banten", []string{"BANK BANTEN"}}, {"Bank Bengkulu", []string{"BANK BENGKULU", "BPD BENGKULU"}},
	{"Bank Bumi Arta", []string{"BUMI ARTA"}}, {"Bank Capital", []string{"BANK CAPITAL"}},
	{"Bank China Construction", []string{"CHINA CONSTRUCTION", "BANK CCB"}}, {"Bank CTBC", []string{"BANK CTBC"}},
	{"Bank DBS", []string{"BANK DBS"}}, {"Bank DIY", []string{"BANK DIY", "BPD DIY"}},
	{"Bank DKI", []string{"BANK DKI", "BPD DKI"}}, {"Bank Ganesha", []string{"BANK GANESHA"}},
	{"Bank Hana", []string{"BANK HANA", "KEB HANA"}}, {"Bank IBK", []string{"BANK IBK"}},
	{"Bank Ina Perdana", []string{"INA PERDANA"}}, {"Bank Index", []string{"BANK INDEX"}},
	{"Bank Jago", []string{"BANK JAGO"}}, {"Bank Jambi", []string{"BANK JAMBI", "BPD JAMBI"}},
	{"Bank Jateng", []string{"BANK JATENG", "BPD JATENG"}}, {"Bank Jatim", []string{"BANK JATIM", "BPD JATIM"}},
	{"Bank Kalbar", []string{"BANK KALBAR", "BPD KALBAR"}}, {"Bank Kalsel", []string{"BANK KALSEL", "BPD KALSEL"}},
	{"Bank Kalteng", []string{"BANK KALTENG", "BPD KALTENG"}}, {"Bank Kaltim", []string{"BANK KALTIM", "KALTIMTARA", "BPD KALTIM"}},
	{"Bank Lampung", []string{"BANK LAMPUNG", "BPD LAMPUNG"}}, {"Bank Maluku Malut", []string{"BANK MALUKU", "BPD MALUKU"}},
	{"Bank Mandiri Taspen", []string{"MANDIRI TASPEN"}}, {"Bank Maspion", []string{"BANK MASPION"}},
	{"Bank Mayora", []string{"BANK MAYORA"}}, {"Bank Mestika", []string{"BANK MESTIKA"}},
	{"Bank MNC", []string{"BANK MNC", "MNC BANK"}}, {"Bank Nagari", []string{"BANK NAGARI", "BPD SUM-BAR", "BPD SUMBAR"}},
	{"Bank Nobu", []string{"BANK NOBU", "NOBU BANK"}}, {"Bank NTB", []string{"BANK NTB", "BPD NTB"}},
	{"Bank NTT", []string{"BANK NTT", "BPD NTT"}}, {"Bank Papua", []string{"BANK PAPUA", "BPD PAPUA"}},
	{"Bank QNB", []string{"BANK QNB"}}, {"Bank Raya (BRI Agro)", []string{"BANK RAYA", "BRI AGRO"}},
	{"Bank Resona Perdania", []string{"RESONA PERDANIA"}}, {"Bank Riau Kepri", []string{"RIAU KEPRI", "BPD RIAU"}},
	{"Bank Sahabat Sampoerna", []string{"SAHABAT SAMPOERNA", "BANK SAMPOERNA"}}, {"Bank Shinhan", []string{"BANK SHINHAN"}},
	{"Bank Sulselbar", []string{"BANK SULSELBAR", "BPD SULSELBAR"}}, {"Bank Sulteng", []string{"BANK SULTENG", "BPD SULTENG"}},
	{"Bank Sultra", []string{"BANK SULTRA", "BPD SULTRA"}}, {"Bank Sulut", []string{"BANK SULUT", "BPD SULUT"}},
	{"Bank Sumsel Babel", []string{"SUMSEL BABEL", "BPD SUMSEL"}}, {"Bank Sumut", []string{"BANK SUMUT", "BPD SUMUT"}},
	{"Bank Victoria", []string{"BANK VICTORIA"}}, {"Bank Woori Saudara", []string{"WOORI SAUDARA", "BANK WOORI"}},
	{"Blu (BCA Digital)", []string{"BCA DIGITAL", "BANK BLU", " BLU "}},
	{"BCA", []string{" BCA ", "BANK CENTRAL ASIA"}}, {"BJB", []string{" BJB ", "BANK JABAR", "BPD JABAR"}},
	{"BNI", []string{" BNI ", "BANK NEGARA INDONESIA"}}, {"BPD Bali", []string{"BPD BALI", "BANK BALI"}},
	{"BRI", []string{" BRI ", "BANK RAKYAT INDONESIA"}}, {"BSI", []string{" BSI ", "BANK SYARIAH INDONESIA"}},
	{"BTN", []string{" BTN ", "BANK TABUNGAN NEGARA"}}, {"BTPN", []string{" BTPN ", "BANK SMBC"}},
	{"Bukopin", []string{"BUKOPIN", "KB BANK"}}, {"CIMB Niaga", []string{"CIMB NIAGA"}},
	{"Citibank", []string{"CITIBANK", "CITI BANK"}}, {"Commonwealth", []string{"COMMONWEALTH"}},
	{"Danamon", []string{"DANAMON"}}, {"Hibank", []string{"HIBANK", "BANK MAYORA"}},
	{"HSBC", []string{" HSBC "}}, {"Mandiri", []string{" MANDIRI ", "BANK MANDIRI"}},
	{"Maybank", []string{"MAYBANK", "BII MAYBANK"}}, {"Mega", []string{"BANK MEGA"}},
	{"Muamalat", []string{"MUAMALAT"}}, {"Neo Commerce", []string{"NEO COMMERCE", "BANK NEO"}},
	{"OCBC NISP", []string{"OCBC NISP", "BANK OCBC"}}, {"Panin", []string{"BANK PANIN", " PANIN "}},
	{"Permata", []string{"PERMATA"}}, {"Sea Bank", []string{"SEABANK", "SEA BANK"}},
	{"Sinarmas", []string{"SINARMAS"}}, {"Superbank", []string{"SUPERBANK", "BANK FAMA"}},
	{"UOB", []string{" UOB "}},
}

var namedAliases = []providerAlias{
	{"Telkomsel", []string{"TELKOMSEL", "TSEL"}}, {"Indosat", []string{"INDOSAT", "ISAT", "IM3"}},
	{"Smartfren", []string{"SMARTFREN", "SMART "}}, {"Axis", []string{"AXIS"}},
	{"XL", []string{" XL ", "XTRA"}}, {"Tri", []string{" THREE ", " TRI ", "TRI ", "HAPPY", "AON"}},
	{"Netflix", []string{"NETFLIX"}}, {"Google Play", []string{"GOOGLE PLAY"}},
	{"PlayStation Network", []string{"PLAY STATION", "PLAYSTATION", " PSN"}}, {"iQIYI", []string{"IQIYI"}},
	{"WiFi.id", []string{"WIFI.ID", "WIFI ID"}}, {"DANA", []string{" DANA "}},
	{"GoPay", []string{"GOPAY"}}, {"OVO", []string{" OVO "}}, {"ShopeePay", []string{"SHOPEE"}},
}

var walletAliases = []providerAlias{
	{"DANA", []string{" DANA "}}, {"GoPay", []string{"GOPAY"}},
	{"OVO", []string{" OVO "}}, {"ShopeePay", []string{"SHOPEE"}},
	{"LinkAja", []string{"LINKAJA"}},
}

func displayProvider(brand, category, sku, name string) string {
	brand = strings.TrimSpace(brand)
	upperName := " " + strings.ToUpper(strings.Join(strings.Fields(name), " ")) + " "
	if !isGenericProvider(brand, category) {
		if strings.EqualFold(brand, "shopee") {
			return "ShopeePay"
		}
		return brand
	}

	switch strings.ToLower(strings.TrimSpace(category)) {
	case "asuransi":
		return titleProvider(strings.TrimSpace(strings.TrimPrefix(upperName, " ASURANSI ")))
	case "multifinance":
		return financeProvider(sku, upperName)
	case "pajak daerah":
		return publicProvider(upperName, "Pajak Daerah")
	case "samsat":
		return publicProvider(upperName, "Samsat")
	case "tagihan air":
		return waterProvider(upperName)
	case "tagihan gas":
		if strings.Contains(upperName, "PERTAGAS") {
			return "Pertagas"
		}
		return "PGN"
	case "transfer bank", "bank transfer":
		if strings.EqualFold(sku, "CEKBIFAST") {
			return "BI-FAST"
		}
		return bankProvider(upperName)
	case "voucher data":
		if provider := aliasMatch(upperName, namedAliases); provider != "" {
			return provider
		}
		return publicProvider(upperName, "Voucher Pulsa24Jam")
	case "paket data":
		if provider := aliasMatch(upperName, namedAliases); provider != "" {
			return provider
		}
		if strings.Contains(upperName, "PRODUK PO") {
			return "Produk PO"
		}
		return publicProvider(upperName, "Paket Data Pulsa24Jam")
	}
	if brand != "" {
		return brand
	}
	return "Pulsa24Jam"
}

func bankProvider(upperName string) string {
	text := strings.TrimSpace(upperName)
	for _, prefix := range []string{
		"WITHDRAWAL DEPOSIT TUJUAN ", "WITHDRAWAL ALL BANK ALTERNATIF ",
		"WITHDRAWAL ALL BANK SECONDARY ", "WITHDRAWAL ALL BANK ", "WITHDRAWAL ",
		"CEK AKUN ", "CEK NAMA ", "TOPUP ", "SALDO ",
	} {
		text = strings.TrimPrefix(text, prefix)
	}
	text = strings.ReplaceAll(text, "BANK BPD ", "BANK ")
	text = strings.ReplaceAll(text, "PT. BPD ", "BANK ")
	text = strings.ReplaceAll(text, "PT. BANK ", "BANK ")
	text = strings.ReplaceAll(text, "PT BANK ", "BANK ")
	padded := " " + text + " "
	if provider := aliasMatch(padded, walletAliases); provider != "" {
		return provider
	}
	if provider := aliasMatch(padded, bankAliases); provider != "" {
		return provider
	}
	text = amountTail.ReplaceAllString(text, "")
	text = strings.TrimSuffix(strings.TrimSpace(text), " UUS")
	return titleProvider(text)
}

func isGenericProvider(brand, category string) bool {
	generic := map[string]bool{
		"": true, "asuransi": true, "multifinance": true, "pbb": true, "paket data": true,
		"samsat": true, "pdam": true, "gas": true, "bank": true, "voucher": true,
	}
	return generic[strings.ToLower(strings.TrimSpace(brand))] || strings.EqualFold(brand, category)
}

func aliasMatch(upperText string, aliases []providerAlias) string {
	for _, provider := range aliases {
		for _, alias := range provider.aliases {
			if strings.Contains(upperText, alias) {
				return provider.name
			}
		}
	}
	return ""
}

func financeProvider(sku, upperName string) string {
	text := strings.TrimSpace(upperName)
	for _, prefix := range []string{"PPOB ", "PEMBAYARAN ", "ANGSURAN ", "PT. ", "PT "} {
		text = strings.TrimPrefix(text, prefix)
	}
	text = feeTail.ReplaceAllString(text, "")
	text = strings.TrimSpace(strings.TrimSuffix(text, " MANDALA"))
	if text == "" {
		text = sku
	}
	return titleProvider(text)
}

func waterProvider(upperName string) string {
	text := strings.TrimSpace(upperName)
	text = leadingCode.ReplaceAllString(text, "")
	text = strings.TrimSpace(strings.TrimPrefix(text, "PPOB "))
	text = feeTail.ReplaceAllString(text, "")
	if !strings.Contains(text, "PDAM") && !strings.Contains(text, "PAM ") && !strings.Contains(text, "PERUMDA") {
		text = "PDAM " + text
	}
	return titleProvider(text)
}

func publicProvider(upperName, fallback string) string {
	text := strings.TrimSpace(upperName)
	text = leadingCode.ReplaceAllString(text, "")
	for _, prefix := range []string{"TOPUP ", "SALDO ", "PPOB ", "VOUCHER ", "PEMBAYARAN "} {
		text = strings.TrimPrefix(text, prefix)
	}
	text = amountTail.ReplaceAllString(text, "")
	text = feeTail.ReplaceAllString(text, "")
	text = strings.TrimSpace(text)
	if text == "" {
		return fallback
	}
	return titleProvider(text)
}

func titleProvider(value string) string {
	words := strings.Fields(strings.TrimSpace(value))
	for i, word := range words {
		if word == "PDAM" || word == "PAM" || word == "PBB" || word == "BPHTB" || word == "DKI" || word == "PGN" || word == "ACC" || word == "BAF" || word == "BCA" || word == "BFI" || word == "MNC" || word == "OTO" || word == "SMS" || word == "PT." || word == "PT" {
			continue
		}
		runes := []rune(strings.ToLower(word))
		if len(runes) > 0 {
			runes[0] = unicode.ToUpper(runes[0])
		}
		words[i] = string(runes)
	}
	return strings.Join(words, " ")
}
