import React, { useMemo, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import imgTick from "../assets/tick.png";
import imgTick2 from "../assets/tick2.png";
import {
  serviceDetail as SERVICE,
  detailTierNames as TIER_NAMES,
  detailContentTabs as CONTENT_TABS,
} from "../data/serviceDetail";
import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  SquareCheck,
  Shield,
} from "lucide-react";
import "../styles/ServicesDetail.css";

/**
 * Retrofit Portal — Service Detail Page
 * --------------------------------------
 * Rendered at the "/services/:id" route.
 *
 * All service content (hero, tiers, overview, whats-included, timeline and
 * compliance cards) is imported from src/data/serviceDetail.js — replace with
 * a real fetch keyed on the :id route param once a backend is ready.
 */

export default function ServiceDetail() {
  const [activeTier, setActiveTier] = useState("Basic");
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedAddons, setSelectedAddons] = useState([]);

  const tier = SERVICE.tiers[activeTier];

  const total = useMemo(() => {
    const addonsTotal = tier.addons
      .filter((a) => selectedAddons.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0);
    return tier.price + addonsTotal;
  }, [tier, selectedAddons]);

  function toggleAddon(id) {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function handleTierChange(name) {
    setActiveTier(name);
    setSelectedAddons([]);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0B1E36] font-sans">
      <Header />

      <main>
        {/* Hero */}
        <section className="max-w-[860px] mx-auto text-center pt-12 sm:pt-16 pb-10 sm:pb-12 px-4">
          <span
            className="sd-hero-badge inline-flex items-center justify-center gap-[10px] rounded-[32px] px-[10px] font-['Inter'] font-semibold text-[12px] leading-[12px] tracking-[0.6px] align-middle whitespace-nowrap text-[#12B14E] bg-[#12B14E4F]"
          >
            <img src={imgTick} alt="" className="w-3.5 h-3.5 shrink-0" />
            {SERVICE.badge}
          </span>
          <h1 className="hero-title">{SERVICE.title}</h1>
          <p className="hero-subtitle">{SERVICE.subtitle}</p>
        </section>

        {/* Gallery + pricing card */}
        <section className="max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Gallery */}
          <div>
            <div className="relative rounded-2xl overflow-hidden h-[240px] sm:h-[360px] lg:h-[420px]">
              <img
                src={SERVICE.heroImage}
                alt={SERVICE.title}
                className="w-full h-full object-cover"
              />
              <span
                className="sd-image-badge absolute top-[25px] left-[25.5px] inline-flex items-center justify-center gap-1 rounded-[8px] bg-[#12B14E] text-white"
              >
                <img src={imgTick2} alt="" className="w-3.5 h-3.5 shrink-0" />
                {SERVICE.heroBadge}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              {SERVICE.thumbnails.map((src, i) => (
                <div
                  key={i}
                  className="h-[110px] rounded-xl overflow-hidden"
                >
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pricing card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
            <div className="bg-[#0B1E36] flex">
              {TIER_NAMES.map((name) => (
                <button
                  key={name}
                  onClick={() => handleTierChange(name)}
                  className={`flex-1 text-[14px] py-4 font-medium transition relative ${
                    activeTier === name
                      ? "text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {name}
                  {activeTier === name && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0F9D58]" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <span className="text-[28px] font-bold text-[#0B1E36]">
                  £{tier.price.toFixed(2)}
                </span>
                <span className="text-[13px] text-slate-400 mt-2">
                  {tier.tierLabel}
                </span>
              </div>

              <p className="mt-3 text-[13px] text-slate-500 leading-relaxed">
                {tier.description}
              </p>

              <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2.5 text-[14px] text-[#0B1E36]">
                  <Clock size={17} className="text-slate-400" />
                  {tier.delivery}
                </div>
                <div className="flex items-center gap-2.5 text-[14px] text-[#0B1E36]">
                  <FileText size={17} className="text-slate-400" />
                  {tier.survey}
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-slate-100">
                <p className="text-[11px] font-bold tracking-wide text-slate-400 mb-3">
                  ADD-ONS
                </p>
                <div className="space-y-3">
                  {tier.addons.map((addon) => (
                    <label
                      key={addon.id}
                      className="flex items-center justify-between text-[14px] cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedAddons.includes(addon.id)}
                          onChange={() => toggleAddon(addon.id)}
                          className="w-4 h-4 rounded border-slate-300 text-[#0F9D58] focus:ring-[#0F9D58]"
                        />
                        {addon.label}
                      </span>
                      <span className="font-medium text-[#0B1E36]">
                        +£{addon.price}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() =>
                  alert(`Starting project — total £${total.toFixed(2)}`)
                }
                className="mt-6 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#0B1E36] to-[#0E4F5C] hover:opacity-90 transition text-white text-[14px] font-medium py-3.5 rounded-xl"
              >
                Start Project
                <ArrowRight size={16} />
              </button>

              <p className="mt-3 text-center text-[12px] text-slate-400">
                Price includes VAT and certification fees.
              </p>
            </div>
          </div>
        </section>

        {/* Content tabs */}
        <section className="max-w-5xl mx-auto px-4 mt-12 sm:mt-16">
          <div className="flex items-center justify-center gap-6 sm:gap-12 border-b border-dashed border-slate-200 relative overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {CONTENT_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-[14px] sm:text-[16px] font-semibold transition relative whitespace-nowrap ${
                  activeTab === tab
                    ? "text-[#0B1E36]"
                    : "text-slate-400 hover:text-slate-500"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#0F9D58]" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Tab content */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          {activeTab === "Overview" && (
            <div>
              <h2 className="section-heading">{SERVICE.overview.heading}</h2>
              {SERVICE.overview.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-[15px] text-slate-600 leading-relaxed mb-4 max-w-4xl"
                >
                  {p}
                </p>
              ))}
              <p className="text-[15px] text-slate-700 font-medium mt-6 mb-3">
                {SERVICE.overview.listIntro}
              </p>
              <ul className="space-y-2">
                {SERVICE.overview.list.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[15px] text-slate-600"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "What's Included" && (
            <div>
              <h2 className="text-[26px] font-bold text-[#0B1E36] mb-5">
                Project Deliverables
              </h2>
              <ul className="space-y-4">
                {SERVICE.whatsIncluded.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-[15px] text-slate-600"
                  >
                    <CheckCircle2
                      size={20}
                      className="text-[#0F9D58] shrink-0 mt-0.5"
                      fill="#0F9D58"
                      color="#ffffff"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "Timeline" && (
            <div className="max-w-2xl pt-8">
              <div className="timeline-heading">Milestone Timeline</div>
              <div className="timeline-list">
                {SERVICE.timeline.map((item, i) => (
                  <div className="timeline-row" key={i}>
                    <div className={`timeline-marker timeline-marker--${item.status}`}>
                      {item.status === "completed" && <Check size={12} />}
                      {item.status !== "completed" && (i + 1)}
                    </div>
                    <div className="timeline-content">
                      <p className="timeline-title">{item.step}: {item.title}</p>
                      <p className="timeline-desc">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Compliance" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {SERVICE.compliance.map((c, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-7 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="relative w-[22px] h-[22px] flex items-center justify-center">
                      {c.icon === "audit" ? (
                        <SquareCheck size={22} strokeWidth={2} className="text-[#0F9D58]" />
                      ) : (
                        <Shield size={22} strokeWidth={2} className="text-[#0F9D58]" />
                      )}
                    </span>
                    <h4 className="compliance-title">
                      {c.title}
                    </h4>
                  </div>
                  <p className="mt-2.5 text-[14px] text-[#6B7280] leading-[1.6] max-w-[340px]">
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}


