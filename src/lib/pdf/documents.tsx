import "server-only";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { terbilangRupiah } from "@/lib/format/terbilang";
import { formatRupiah } from "@/lib/money";
import type { ReceiptData } from "@/lib/pdf/receipt-data";

// Dokumen PDF transaksi & kuitansi (P19, T-34) dengan @react-pdf/renderer (runtime nodejs saja).
// Font Plus Jakarta Sans (OFL, src/lib/pdf/fonts) dibaca dari disk — tidak ada fetch runtime.

const FONT_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const FAMILY = "PlusJakartaSans";
Font.register({
  family: FAMILY,
  fonts: [
    { src: path.join(FONT_DIR, "PlusJakartaSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "PlusJakartaSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// Tanpa pemenggalan kata otomatis (nama & terbilang tidak dipotong dengan tanda hubung).
Font.registerHyphenationCallback((word) => [word]);

// Logo (scripts/brand-assets.ts) dibundel di samping font; dibaca dari disk tanpa fetch.
const LOGO_PATH = path.join(process.cwd(), "src/lib/pdf/brand/logo-wide.png");
const LOGO_RATIO = 1950 / 381;

// Warna merek (src/app/globals.css).
const PRIMARY = "#086828";
const ORANGE = "#F89808";
const INK = "#1f2937";
const SOFT = "#6b7280";

const s = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: 10, color: INK, padding: 40, lineHeight: 1.4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: ORANGE,
    paddingBottom: 10,
    marginBottom: 16,
  },
  logo: { height: 30, width: 30 * LOGO_RATIO },
  orgBox: { maxWidth: "55%", alignItems: "flex-end" },
  org: { fontSize: 12, fontWeight: 700, color: PRIMARY, textAlign: "right" },
  address: { fontSize: 9, color: SOFT, marginTop: 2, textAlign: "right" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  sub: { fontSize: 9, color: SOFT, marginBottom: 14 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  label: { width: "36%", color: SOFT },
  value: { width: "64%", fontWeight: 700 },
  amountBox: { marginTop: 14, padding: 10, backgroundColor: "#E6F4EA", borderRadius: 4 },
  amount: { fontSize: 16, fontWeight: 700, color: PRIMARY },
  words: { marginTop: 6, fontSize: 10 },
  sign: { marginTop: 30, alignSelf: "flex-end", width: 200, textAlign: "center" },
  signName: { marginTop: 36, fontWeight: 700, borderTopWidth: 0.5, borderTopColor: INK, paddingTop: 4 },
  note: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: SOFT, textAlign: "center" },
});

const wib = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" });
export const formatWib = (d: Date | string) => `${wib.format(new Date(d))} WIB`;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

function Header({ name, address }: { name: string; address: string }) {
  return (
    <View style={s.header}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf tidak punya alt */}
      <Image src={LOGO_PATH} style={s.logo} />
      <View style={s.orgBox}>
        <Text style={s.org}>{name}</Text>
        {address ? <Text style={s.address}>{address}</Text> : null}
      </View>
    </View>
  );
}

const NOTE = "Dokumen ini dibuat secara elektronik dan sah tanpa tanda tangan basah.";

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const amount = BigInt(data.amount);
  return (
    <Document title={`Kuitansi ${data.receiptNo}`} author={data.organizationName} creator={data.organizationName} producer={data.organizationName}>
      <Page size="A4" style={s.page}>
        <Header name={data.organizationName} address={data.organizationAddress} />
        <Text style={s.title}>KUITANSI DONASI</Text>
        <Text style={s.sub}>Nomor: {data.receiptNo}</Text>
        <Row label="Telah diterima dari" value={data.donorName} />
        <Row label="Untuk program" value={data.campaignTitle} />
        <Row label="Tanggal pembayaran" value={formatWib(data.paidAt)} />
        <Row label="Metode pembayaran" value={data.methodName} />
        <Row label="Kode transaksi" value={data.code} />
        <View style={s.amountBox} wrap={false}>
          <Text style={s.amount}>{formatRupiah(amount)}</Text>
          <Text style={s.words}>Terbilang: {terbilangRupiah(amount)}</Text>
        </View>
        <View style={s.sign} wrap={false}>
          <Text>{formatWib(data.issuedAt).replace(/ pukul .*$/, "")}</Text>
          <Text>{data.organizationName}</Text>
          <Text style={s.signName}>{data.signatory}</Text>
        </View>
        <Text style={s.note} fixed>
          {NOTE} Jazakumullahu khairan atas donasi Anda.
        </Text>
      </Page>
    </Document>
  );
}

export interface TransactionSummaryData {
  organizationName: string;
  organizationAddress: string;
  code: string;
  statusLabel: string;
  campaignTitle: string;
  donorName: string;
  amount: bigint;
  createdAt: Date;
  paidAt: Date | null;
  methodName: string | null;
  receiptNo: string | null;
  generatedAt: Date;
}

export function SummaryDocument({ data }: { data: TransactionSummaryData }) {
  return (
    <Document title={`Ringkasan transaksi ${data.code}`} author={data.organizationName} creator={data.organizationName} producer={data.organizationName}>
      <Page size="A4" style={s.page}>
        <Header name={data.organizationName} address={data.organizationAddress} />
        <Text style={s.title}>RINGKASAN TRANSAKSI DONASI</Text>
        <Text style={s.sub}>Kode transaksi: {data.code}</Text>
        <Row label="Status" value={data.statusLabel} />
        <Row label="Program" value={data.campaignTitle} />
        <Row label="Nama donatur" value={data.donorName} />
        <Row label="Nominal" value={formatRupiah(data.amount)} />
        <Row label="Dibuat" value={formatWib(data.createdAt)} />
        {data.paidAt ? <Row label="Dibayar" value={formatWib(data.paidAt)} /> : null}
        {data.methodName ? <Row label="Metode pembayaran" value={data.methodName} /> : null}
        {data.receiptNo ? <Row label="No. kuitansi" value={data.receiptNo} /> : null}
        <Text style={s.note} fixed>
          {NOTE} Dicetak {formatWib(data.generatedAt)}. Ringkasan ini bukan kuitansi.
        </Text>
      </Page>
    </Document>
  );
}

export const renderReceiptPdf = (data: ReceiptData): Promise<Buffer> => renderToBuffer(<ReceiptDocument data={data} />);

export const renderSummaryPdf = (data: TransactionSummaryData): Promise<Buffer> =>
  renderToBuffer(<SummaryDocument data={data} />);
