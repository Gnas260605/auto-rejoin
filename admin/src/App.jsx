import React, { useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { AdminLayout } from "./layouts/AdminLayout.jsx";
import { LicensesPage } from "./pages/LicensesPage.jsx";
import { LicenseDetailPage } from "./pages/LicenseDetailPage.jsx";
import { AuditLogsPage } from "./pages/AuditLogsPage.jsx";

export function App() {
  const { admin, loading } = useAuth();
  const [activePage, setActivePage] = useState("licenses");
  const [selectedLicenseId, setSelectedLicenseId] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Loading Console...
          </span>
        </div>
      </div>
    );
  }

  if (!admin) {
    return <LoginPage />;
  }

  const handleNavigate = (page) => {
    setSelectedLicenseId(null);
    setActivePage(page);
  };

  return (
    <AdminLayout activePage={activePage} onNavigate={handleNavigate}>
      {selectedLicenseId ? (
        <LicenseDetailPage
          licenseId={selectedLicenseId}
          onBack={() => setSelectedLicenseId(null)}
        />
      ) : activePage === "licenses" ? (
        <LicensesPage onSelectLicense={(id) => setSelectedLicenseId(id)} />
      ) : activePage === "audits" ? (
        <AuditLogsPage />
      ) : null}
    </AdminLayout>
  );
}
