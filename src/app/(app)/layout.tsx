import AuthProvider from "@/components/common/AuthProvider";
import AppShell from "@/components/common/AppShell";
import MasterDataProvider from "@/components/common/MasterDataProvider";
import AttendanceGate from "@/components/common/AttendanceGate";

// Semua halaman aplikasi (home, admin, florist, kurir, attendance, account)
// hidup di route group ini supaya digate oleh login JWT. Halaman publik
// seperti /telegram-setup sengaja ditaruh DI LUAR grup ini supaya tidak
// ikut ke-block oleh AuthProvider (user belum tentu punya JWT saat itu).
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <MasterDataProvider>
        <AttendanceGate>
          <AppShell>{children}</AppShell>
        </AttendanceGate>
      </MasterDataProvider>
    </AuthProvider>
  );
}
