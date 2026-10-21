"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AuthPage from "@/features/auth/AuthPage";
import Dialog from "@/components/Dialog";
import { api } from "@/lib/api";
import { useMe } from "./shared";
import Overview from "./Overview";
import Products from "./Products";
import Inventory from "./Inventory";
import Orders from "./Orders";
import Enquiries from "./Enquiries";
import Content from "./Content";
import Team from "./Team";
import Delivery from "./Delivery";
import Collections from "./Collections";
import Profile from "./Profile";
import Finance from "./Finance";
export default function AdminShell({
  section = "overview",
}: {
  section?: string;
}) {
  const router = useRouter();
  const { data: user, error, isLoading } = useMe();
  const [menu, setMenu] = useState(false);
  const q = useQueryClient();
  if (isLoading)
    return (
      <div className="admin-app">
        <div className="app-section">Opening the studio…</div>
      </div>
    );
  if (error || !user) return <AuthPage admin />;
  if (!user.staff_role)
    return (
      <div className="app-section">
        <h1>Studio access is required.</h1>
        <p>This account has no active studio membership.</p>
        <Link href="/account">Your account ↗</Link>
      </div>
    );
  const owner = user.staff_role === "owner";
  const nav = [
    ["overview", "Overview", "◈"],
    ["orders", "Orders", "▤"],
    ["products", "Products", "◒"],
    ["inventory", "Inventory", "▦"],
    ["enquiries", "Enquiries", "✉"],
    ...(owner
      ? [
          ["collections", "Collections", "◇"],
          ["content", "Website content", "▣"],
          ["delivery", "Delivery areas", "⌖"],
          ["finance", "Payments & audit", "₹"],
          ["team", "Team & access", "♧"],
        ]
      : []),
    ["profile", "My profile", "○"],
  ];
  function links() {
    return (
      <>
        <Link className="brand" href="/admin">
          Auraflare<small>THE CANDLE STUDIO</small>
        </Link>
        <div className="nav-label">YOUR STUDIO</div>
        <nav className="nav" aria-label="Studio navigation">
          {nav.map(([key, label, icon]) => (
            <Link
              className={section === key ? "active" : ""}
              key={key}
              href={key === "overview" ? "/admin" : "/admin/" + key}
              onClick={() => setMenu(false)}
              aria-current={section === key ? "page" : undefined}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="studio">
          <small>YOUR CANDLE STUDIO</small>
          <p>
            Small rituals.
            <br />
            Lovely moments.
          </p>
          <Link href="/">View the storefront ↗</Link>
        </div>
        <div className="side-bottom">
          <Link href="/admin/profile" className="profile-entry">
            <span className="avatar">{user?.name[0]}</span>
            <div>
              <strong className="profile-name">{user?.name}</strong>
              <small>{owner ? "Owner" : "Fulfillment staff"}</small>
            </div>
          </Link>
          <button
            className="sign-out"
            aria-label="Sign out"
            onClick={async () => {
              await api("post", "/auth/logout");
              q.clear();
              router.replace("/admin");
            }}
          >
            ↗
          </button>
        </div>
      </>
    );
  }
  const screens: Record<string, React.ReactNode> = {
    overview: <Overview />,
    products: <Products />,
    inventory: <Inventory />,
    orders: <Orders />,
    enquiries: <Enquiries />,
    collections: <Collections />,
    content: <Content />,
    delivery: <Delivery />,
    team: <Team />,
    profile: <Profile />,
    finance: <Finance />,
  };
  return (
    <div className="admin-app">
      <aside className="sidebar desktop-sidebar">{links()}</aside>
      {menu && (
        <Dialog
          title="Studio navigation"
          className="sidebar mobile-sidebar"
          onClose={() => setMenu(false)}
        >
          {links()}
        </Dialog>
      )}
      <div className="main">
        <div className="topbar">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            ☰
          </button>
          <span className="crumb">
            Your studio{" "}
            <span>
              / {nav.find((n) => n[0] === section)?.[1] || "Overview"}
            </span>
          </span>
          <div className="top-actions">
            <span className="pill">
              {owner ? "OWNER ACCESS" : "FULFILLMENT ACCESS"}
            </span>
            <Link
              className="avatar"
              href="/admin/profile"
              aria-label="My profile"
            >
              {user.name[0]}
            </Link>
          </div>
        </div>
        <main className="page">
          {!owner &&
          ["collections", "content", "delivery", "finance", "team"].includes(
            section,
          ) ? (
            <section>
              <h1>Owner access is required.</h1>
              <p>
                Your fulfillment access covers orders, inventory and enquiries.
              </p>
            </section>
          ) : (
            screens[section] || <p>This studio section was not found.</p>
          )}
        </main>
      </div>
    </div>
  );
}
