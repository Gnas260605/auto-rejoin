import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { AdminLayout } from "./layouts/AdminLayout.jsx";
import { DashboardStatsPage } from "./pages/DashboardStatsPage.jsx";
import { LicensesPage } from "./pages/LicensesPage.jsx";
import { LicenseDetailPage } from "./pages/LicenseDetailPage.jsx";
import { AuditLogsPage } from "./pages/AuditLogsPage.jsx";
import { PricingSettingsPage } from "./pages/PricingSettingsPage.jsx";
import { StorefrontPage } from "./pages/StorefrontPage.jsx";
import { CustomerPortalPage } from "./pages/CustomerPortalPage.jsx";
import { ApiManagementPage } from "./pages/ApiManagementPage.jsx";
import { MarketingAdsPage } from "./pages/MarketingAdsPage.jsx";
import { PayOSManagementPage } from "./pages/PayOSManagementPage.jsx";
import { InteractiveShaderBackground } from "./components/InteractiveShaderBackground.jsx";

export function App() {
  const { admin, loading } = useAuth();
  const [currentView, setCurrentView] = useState("storefront");
  const [activeAdminPage, setActiveAdminPage] = useState("dashboard");
  const [selectedLicenseId, setSelectedLicenseId] = useState(null);

  // If admin is logged in, default to dashboard if they navigate to admin
  useEffect(() => {
    if (admin && currentView === "login") {
      setCurrentView("admin");
    }
  }, [admin, currentView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080D17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Đang tải hệ thống...
          </span>
        </div>
      </div>
    );
  }

  // View: Public Storefront (Has Interactive Shader Background)
  if (currentView === "storefront") {
    return (
      <>
        <InteractiveShaderBackground />
        <StorefrontPage
          onNavigateToPortal={() => setCurrentView("portal")}
          onNavigateToAdmin={() => setCurrentView(admin ? "admin" : "login")}
        />
      </>
    );
  }

  // View: Customer Self-Service Portal (Has Interactive Shader Background)
  if (currentView === "portal") {
    return (
      <>
        <InteractiveShaderBackground />
        <CustomerPortalPage
          onBackToStore={() => setCurrentView("storefront")}
        />
      </>
    );
  }

  // View: Admin Login (No Shader Background - Solid Clean SaaS Dark)
  if (currentView === "login" || (!admin && currentView === "admin")) {
    return (
      <div className="min-h-screen bg-[#080D17]">
        <LoginPage
          onBackToStore={() => setCurrentView("storefront")}
        />
      </div>
    );
  }

  // View: Admin Console (Authenticated - No Shader Background - Pure SaaS Dashboard)
  const handleAdminNavigate = (page) => {
    if (page === "storefront") {
      setCurrentView("storefront");
      return;
    }
    if (page === "portal") {
      setCurrentView("portal");
      return;
    }
    setSelectedLicenseId(null);
    setActiveAdminPage(page);
  };

  return (
    <div className="min-h-screen bg-[#080D17]">
      <AdminLayout activePage={activeAdminPage} onNavigate={handleAdminNavigate}>
        {selectedLicenseId ? (
          <LicenseDetailPage
            licenseId={selectedLicenseId}
            onBack={() => setSelectedLicenseId(null)}
          />
        ) : activeAdminPage === "dashboard" ? (
          <DashboardStatsPage
            onSelectLicense={(id) => setSelectedLicenseId(id)}
            onNavigateToLicenses={() => setActiveAdminPage("licenses")}
            onNavigateToPayOS={() => setActiveAdminPage("payos")}
          />
        ) : activeAdminPage === "licenses" ? (
          <LicensesPage onSelectLicense={(id) => setSelectedLicenseId(id)} />
        ) : activeAdminPage === "payos" ? (
          <PayOSManagementPage />
        ) : activeAdminPage === "pricing" ? (
          <PricingSettingsPage />
        ) : activeAdminPage === "api" ? (
          <ApiManagementPage />
        ) : activeAdminPage === "marketing" ? (
          <MarketingAdsPage />
        ) : activeAdminPage === "audits" ? (
          <AuditLogsPage />
        ) : null}
      </AdminLayout>
    </div>
  );
}
