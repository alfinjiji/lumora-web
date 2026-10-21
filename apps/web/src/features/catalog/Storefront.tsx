"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { api, money, type Schemas } from "@/lib/api";
import Dialog from "@/components/Dialog";
import { DataForm } from "@/components/Form";
export function Brand() {
  return (
    <Link className="brand" href="/">
      Auraflare<span className="brand-flame">◒</span>
      <small>THE CANDLE STUDIO</small>
    </Link>
  );
}
export function ShopHeader() {
  const [menu, setMenu] = useState(false);
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<Schemas["Cart"]>("get", "/api/v1/cart"),
  });
  return (
    <header>
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/#collection">Shop candles</Link>
        <Link href="/#occasions">The gifting edit</Link>
        <Link href="/#occasions">Weddings & events</Link>
        <Link href="/#story">Our world</Link>
      </nav>
      <button
        className="shop-menu-toggle"
        aria-label="Open shop navigation"
        onClick={() => setMenu(true)}
      >
        ☰
      </button>
      {menu && (
        <Dialog
          title="Shop navigation"
          className="shop-mobile-menu"
          onClose={() => setMenu(false)}
        >
          <Brand />
          <nav aria-label="Mobile shop navigation">
            {[
              ["/#collection", "Shop candles"],
              ["/#occasions", "Gifts & occasions"],
              ["/#story", "Our world"],
              ["/#care", "Candle care"],
              ["/account", "My account"],
            ].map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setMenu(false)}>
                {label} ↗
              </Link>
            ))}
          </nav>
        </Dialog>
      )}
      <div className="bag">
        <Link className="account-shortcut" href="/account">
          Account
        </Link>
        <Link href="/cart" aria-label="Open shopping bag">
          Bag{" "}
          <span id="count">
            {cart?.items.reduce((n, i) => n + i.quantity, 0) || 0}
          </span>{" "}
          ↗
        </Link>
      </div>
    </header>
  );
}
export default function Storefront({
  initialProducts,
  initialCollections,
  initialContent,
  collectionSlug,
}: {
  initialProducts: Schemas["Product"][];
  initialCollections: Schemas["Collection"][];
  initialContent?: Schemas["Content"];
  collectionSlug?: string;
}) {
  const [collection, setCollection] = useState(
      collectionSlug ||
        initialCollections.find(
          (c) => c.id === initialContent?.featured_collection_id,
        )?.slug ||
        "",
    ),
    [sort, setSort] = useState("featured"),
    [event, setEvent] = useState(false),
    [message, setMessage] = useState(""),
    [intro, setIntro] = useState(false),
    [exit, setExit] = useState(false),
    [replay, setReplay] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const productQuery = useInfiniteQuery({
    queryKey: ["products", collection, sort],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await fetch(
        "/api/v1/products?" +
          new URLSearchParams({
            sort,
            page: String(pageParam),
            ...(collection ? { collection } : {}),
          }),
        { credentials: "include" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || "Could not load the collection.",
        );
      return {
        data: result.data as Schemas["Product"][],
        next: result.links?.next ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.next,
    initialData:
      !collection && !collectionSlug && sort === "featured"
        ? {
            pages: [
              {
                data: initialProducts,
                next: initialProducts.length === 20 ? 2 : undefined,
              },
            ],
            pageParams: [1],
          }
        : undefined,
  });
  const products =
    productQuery.data?.pages.flatMap((page) => page.data) || initialProducts;
  const isError = productQuery.isError;
  useEffect(() => {
    const content = contentRef.current;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let cancelled = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 700)),
    ]).then(() => {
      if (cancelled) return;
      timers = [
        setTimeout(() => {
          setIntro(true);
          contentRef.current?.setAttribute("inert", "");
        }, 0),
        setTimeout(() => setExit(true), 3300),
        setTimeout(() => {
          setIntro(false);
          setExit(false);
          contentRef.current?.removeAttribute("inert");
        }, 4150),
      ];
    });
    const skip = () => {
      timers.forEach(clearTimeout);
      setIntro(false);
      setExit(false);
      contentRef.current?.removeAttribute("inert");
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    addEventListener("keydown", key);
    media.addEventListener("change", skip);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      content?.removeAttribute("inert");
      removeEventListener("keydown", key);
      media.removeEventListener("change", skip);
    };
  }, [replay]);
  function skipIntro() {
    setIntro(false);
    setExit(false);
    contentRef.current?.removeAttribute("inert");
    contentRef.current?.querySelector<HTMLElement>("a")?.focus();
  }
  async function add(p: Schemas["Product"]) {
    const v = p.variants.find((v) => v.active && v.available_quantity > 0);
    if (!v) return;
    try {
      const cart = await api<Schemas["Cart"]>("get", "/api/v1/cart");
      await api("post", "/api/v1/cart/items", {
        expected_version: cart.version,
        variant_id: v.id,
        quantity: 1,
      });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      setMessage("A little lovely, added to your bag.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    }
  }
  const hero = initialContent?.hero;
  return (
    <>
      {intro && (
        <section
          className={"opening-overlay " + (exit ? "intro-exit" : "")}
          aria-label="Auraflare introduction"
        >
          <div className="opening-kicker">THE CANDLE STUDIO</div>
          <div className="opening-mark-wrap">
            <div className="opening-mark intro-letters" aria-label="Auraflare">
              {Array.from("Auraflare").map((l, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{ "--letter": i } as React.CSSProperties}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div
            className="opening-quote intro-quote"
            aria-label="A little light. A slower moment."
          >
            {Array.from("A little light. A slower moment.").map((l, i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{ "--letter": i } as React.CSSProperties}
              >
                {l === " " ? " " : l}
              </span>
            ))}
          </div>
          <span className="opening-footnote">
            SMALL RITUALS. LOVELY MOMENTS.
          </span>
          <button className="skip-opening" onClick={skipIntro}>
            Skip intro ↗
          </button>
        </section>
      )}
      <div ref={contentRef}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="announcement">
          {initialContent?.announcement ||
            "A LITTLE LIGHT. A LITTLE LESS HURRY."}
          <span>Discover your everyday ritual ↗</span>
        </div>
        <ShopHeader />
        <main id="main">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="line" />
                FOR THE BEAUTY OF EVERYDAY
              </div>
              <h1>
                {hero?.heading || (
                  <>
                    A little light.
                    <br />A <em>slower</em>
                    <br />
                    moment.
                  </>
                )}
              </h1>
              <p>
                {hero?.subtitle || (
                  <>
                    Candles for quiet evenings, thoughtful gifts,
                    <br className="desktop" /> and the moments you want to hold
                    onto.
                  </>
                )}
              </p>
              <Link className="button" href={hero?.cta_path || "/#collection"}>
                {hero?.cta_label || "Find your glow"} <span>↗</span>
              </Link>
              <a className="text-link" href="#occasions">
                Something for a special occasion? <span>→</span>
              </a>
              <div className="hero-bottom">
                <span>HOME · GIFTS · CELEBRATIONS</span>
                <span>SCROLL TO SLOW DOWN ↓</span>
              </div>
            </div>
            <div className="hero-photo">
              <img
                src={
                  hero?.image_media_id
                    ? "/media/" + hero.image_media_id
                    : "/images/design/hero.webp"
                }
                alt="Glowing candles surrounded by delicate white flowers"
                fetchPriority="high"
              />
              <div className="photo-label">
                The art of a softer evening.
                <span>01 / THE EVERYDAY RITUAL</span>
              </div>
              <div className="seal">
                little things
                <br />
                <i>lovely</i>
                <br />
                moments
              </div>
            </div>
          </section>
          <div className="ribbon">
            <span>Light up your space</span>
            <b>✳</b>
            <span>Give a little warmth</span>
            <b>✳</b>
            <span>Make a moment of it</span>
            <b>✳</b>
            <span>Find your kind of glow</span>
          </div>
          <section className="collection section" id="collection">
            <div className="section-top">
              <div>
                <div className="eyebrow">THE CANDLE EDIT</div>
                <h2>
                  Small details.
                  <br />
                  <em>Beautiful rituals.</em>
                </h2>
              </div>
              <p>
                A shape for every corner.
                <br />A little warmth for every kind of day.
              </p>
            </div>
            <div className="shop-tools">
              <div
                className="filters"
                role="group"
                aria-label="Filter candle collection"
              >
                <button
                  className={!collection ? "active" : ""}
                  aria-pressed={!collection}
                  onClick={() => setCollection("")}
                >
                  All candles
                </button>
                {initialCollections.map((c) => (
                  <button
                    key={c.id}
                    className={collection === c.slug ? "active" : ""}
                    aria-pressed={collection === c.slug}
                    onClick={() => setCollection(c.slug)}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
              <label className="sort">
                Sort by{" "}
                <select
                  aria-label="Sort candles"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="featured">Featured</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
            <div className="products">
              {products.length ? (
                products.map((p) => (
                  <article key={p.id} className="product">
                    <div className="product-photo">
                      <Link
                        className="product-open"
                        href={"/products/" + p.slug}
                      >
                        {p.images[0]?.url ? (
                          <img
                            src={p.images[0].url}
                            alt={p.title}
                            loading="lazy"
                          />
                        ) : (
                          <div className="empty-state">Photo coming soon</div>
                        )}
                        <span className="badge">
                          {p.variants.some((v) => v.available_quantity > 0)
                            ? "THE CANDLE EDIT"
                            : "SOLD OUT"}
                        </span>
                      </Link>
                      <button
                        className="quick-add"
                        aria-label={"Add " + p.title + " to bag"}
                        disabled={
                          !p.variants.some(
                            (v) => v.active && v.available_quantity > 0,
                          )
                        }
                        onClick={() => add(p)}
                      >
                        +
                      </button>
                    </div>
                    <Link href={"/products/" + p.slug}>
                      <div className="product-info">
                        <h3>{p.title}</h3>
                        <span className="price">
                          {money(
                            Math.min(...p.variants.map((v) => v.price_minor)),
                          )}
                        </span>
                      </div>
                      <p>{p.scent_notes?.join(" · ")}</p>
                    </Link>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <h3>
                    {isError
                      ? "A moment, please."
                      : "Something lovely is on its way."}
                  </h3>
                  <p>
                    {isError
                      ? "We couldn’t load the collection. Please try again shortly."
                      : "Our candle collection is being prepared. Come back soon for a little light."}
                  </p>
                </div>
              )}
            </div>
          </section>
          {productQuery.hasNextPage && (
            <div
              className="inline-actions"
              style={{ justifyContent: "center", padding: 24 }}
            >
              <button
                className="button"
                disabled={productQuery.isFetchingNextPage}
                onClick={() => productQuery.fetchNextPage()}
              >
                {productQuery.isFetchingNextPage
                  ? "Opening more candles…"
                  : "Explore more candles ↗"}
              </button>
            </div>
          )}
          <section className="pause" id="story">
            <div className="pause-photo">
              <img
                src="/images/design/pillars.webp"
                alt="Ivory ribbed pillar candles on a ceramic tray"
                loading="lazy"
              />
            </div>
            <div className="pause-copy">
              <div className="eyebrow">A SPACE TO EXHALE</div>
              <h2>
                Less rush.
                <br />
                More <em>ritual.</em>
              </h2>
              <p>
                Pull up your favourite chair. Put your phone aside. Let the room
                become a little softer.
              </p>
              <p>
                Whether it’s the sculptural detail on your shelf or the glow at
                the end of a long day, make a little room for the things that
                feel good.
              </p>
              <a className="text-link" href="#collection">
                Bring the feeling home <span>↗</span>
              </a>
              <span className="handwritten">Make ordinary feel lovely.</span>
            </div>
          </section>
          <section className="occasions section" id="occasions">
            <div className="section-top">
              <div>
                <div className="eyebrow">THOUGHTFUL BY NATURE</div>
                <h2>
                  For you.
                  <br />
                  For them. <em>For the moment.</em>
                </h2>
              </div>
            </div>
            <div className="occasion-grid">
              {[
                [
                  "glass",
                  "EVERYDAY LIVING",
                  "A softer kind of home",
                  "Explore home candles",
                ],
                [
                  "hearts",
                  "JUST BECAUSE",
                  "A gift that feels personal",
                  "Discover the gifting edit",
                ],
                [
                  "tealights",
                  "THE BIG LITTLE MOMENTS",
                  "Set the scene for love",
                  "Plan wedding & event candles",
                ],
              ].map(([image, kicker, title, cta], i) =>
                i === 2 ? (
                  <button
                    className="occasion"
                    key={image}
                    onClick={() => setEvent(true)}
                  >
                    <img
                      src={"/images/design/" + image + ".webp"}
                      alt="Candles arranged for a celebration"
                      loading="lazy"
                    />
                    <div>
                      <small>03 / {kicker}</small>
                      <h3>{title}</h3>
                      <span>{cta} ↗</span>
                    </div>
                  </button>
                ) : (
                  <a className="occasion" href="#collection" key={image}>
                    <img
                      src={"/images/design/" + image + ".webp"}
                      alt={title}
                      loading="lazy"
                    />
                    <div>
                      <small>
                        0{i + 1} / {kicker}
                      </small>
                      <h3>{title}</h3>
                      <span>{cta} ↗</span>
                    </div>
                  </a>
                ),
              )}
            </div>
          </section>
          <section className="care section" id="care">
            <div>
              <div className="eyebrow">A LITTLE CANDLE WISDOM</div>
              <h2>
                Keep the <em>glow</em> going.
              </h2>
            </div>
            <div className="faq">
              {[
                [
                  "How do I care for my candle?",
                  "Follow the care instructions supplied with your candle. Keep wax free of debris and use a stable, heat-resistant surface. Never leave a burning candle unattended.",
                ],
                [
                  "Can I burn sculptural candles?",
                  "Use a heat-resistant tray to catch melted wax and check the individual candle’s care guidance.",
                ],
                [
                  "Can I enquire about gifts or events?",
                  "Share your occasion through the enquiry form. The studio will confirm what is available.",
                ],
                [
                  "How does ordering work?",
                  "Submit an order request. The studio confirms shipping, then you review the final quote before paying. Delivery is available only in enabled Kerala locations.",
                ],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span>+</span>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="closing">
            <span>THERE’S ALWAYS ROOM FOR</span>
            <h2>
              A little more <em>light.</em>
            </h2>
            <a className="button light" href="#collection">
              Discover the collection ↗
            </a>
          </section>
        </main>
        <footer>
          <div>
            <Brand />
            <p>Small rituals. Lovely moments.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <a href="#collection">All candles</a>
            <a href="#occasions">Gifts & occasions</a>
            <Link href="/account">My account</Link>
          </div>
          <div>
            <h4>A little help</h4>
            <a href="#story">Our world</a>
            <a href="#care">Candle care</a>
            <Link href="/orders/access">Find my order</Link>
            <button
              onClick={() => {
                setReplay((n) => n + 1);
              }}
            >
              Replay introduction ↗
            </button>
          </div>
          <div className="footer-note">
            A warm beginning.
            <br />
            <em>A beautiful everyday.</em>
            <small>A candle for your space. A glow for your moments.</small>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Auraflare</span>
            <span>Made for moments that matter.</span>
          </div>
        </footer>
        {message && (
          <div role="status" className="toast visible">
            {message}
            <button
              aria-label="Dismiss notification"
              onClick={() => setMessage("")}
            >
              {" "}
              ×
            </button>
          </div>
        )}
        {event && (
          <Dialog
            title="Wedding and event enquiry"
            className="event-dialog"
            onClose={() => setEvent(false)}
          >
            <div className="eyebrow">WEDDINGS & CELEBRATIONS</div>
            <h2>
              Let’s make it <em>lovely.</em>
            </h2>
            <p>Tell us a little about your day.</p>
            <DataForm
              submit="Send enquiry"
              fields={[
                { name: "name", label: "Your name", required: true },
                {
                  name: "email",
                  label: "Email",
                  type: "email",
                  required: true,
                },
                { name: "phone", label: "Phone number", required: true },
                { name: "event_date", label: "Event date", type: "date" },
                {
                  name: "quantity",
                  label: "Approximate quantity",
                  type: "number",
                  min: 1,
                },
                {
                  name: "message",
                  label: "What do you have in mind?",
                  type: "textarea",
                  required: true,
                },
              ]}
              onSubmit={async (d) => {
                await api("post", "/api/v1/enquiries", {
                  contact: { name: d.name, email: d.email, phone: d.phone },
                  source: "event",
                  message: d.message,
                  ...(d.event_date ? { event_date: d.event_date } : {}),
                  ...(d.quantity ? { quantity: Number(d.quantity) } : {}),
                });
                setMessage("Your enquiry is saved. The studio will review it.");
                setEvent(false);
              }}
            />
          </Dialog>
        )}
      </div>
    </>
  );
}
