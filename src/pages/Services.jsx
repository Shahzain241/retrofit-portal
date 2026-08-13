import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Clock } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import CtaBanner from "../components/CtaBanner";
import imgTick from "../assets/tick.png";
import {
  publicServices as SERVICES,
  serviceCategories as CATEGORIES,
  serviceBudgets as BUDGETS,
} from "../data/services";
import "../styles/Landing.css";
import "../styles/PublicServices.css";

/**
 * Retrofit Portal — Services Page
 * -------------------------------
 * Rendered at the "/services" route.
 *
 * Service catalogue, category filters and budget filters are imported from
 * src/data/services.js — replace with real API data whenever it's ready.
 */

export default function Services() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Services");
  const [budget, setBudget] = useState("under500");

  const filtered = useMemo(() => {
    return SERVICES.filter((s) => {
      const matchesSearch = s.title
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesCategory =
        category === "All Services" || s.category === category;
      const matchesBudget = !budget || s.budget === budget;
      return matchesSearch && matchesCategory && matchesBudget;
    });
  }, [search, category, budget]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0B1E36] font-sans">
      <Header />

      <main>
        {/* Hero */}
        <section className="max-w-[1092px] mx-auto text-center pt-14 pb-7 px-4">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0F9D58] bg-[#EAF8F0] border border-[#CFEEDA] rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0F9D58]" />
            All Services
          </span>
          <h1 className="mt-4 font-['Nunito_Sans'] font-bold text-[48px] leading-[52.8px] tracking-[-0.96px] text-center text-[#0B1C30] capitalize">
            Retrofit Services
          </h1>
          <p className="mt-3 font-['Inter'] font-normal text-[20px] leading-[30px] tracking-[-0.8px] text-center text-[#59585C]">
            Browse premium services designed to inspire and elevate your
            projects.
          </p>
        </section>

        {/* Search */}
        <section className="max-w-[1092px] mx-auto px-4">
          <div className="flex justify-center">
            <div className="relative w-full max-w-[900px]">
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search retrofit services..."
              className="ps-search-input rounded-xl bg-white pl-12 pr-5 text-[14px] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#0F9D58]/25 transition"
            />
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="max-w-[1092px] mx-auto px-4 mt-6">
          <div className="flex justify-center">
            <FilterRow
              label="CATEGORY:"
              className="ps-filter-row"
            >
              {CATEGORIES.map((c) => (
                <Pill
                  key={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Pill>
              ))}
            </FilterRow>
          </div>

          <div className="flex justify-center">
            <FilterRow label="BUDGET:" className="gap-2 mt-2.5">
              {BUDGETS.map((b) => (
                <Pill
                  key={b.key}
                  active={budget === b.key}
                  onClick={() => setBudget(budget === b.key ? "" : b.key)}
                >
                  {b.label}
                </Pill>
              ))}
            </FilterRow>
          </div>

          <div className="mt-6 h-px bg-slate-200 relative">
            <div className="absolute left-1/2 -translate-x-1/2 -top-[1.5px] w-24 h-[2px] rounded-full bg-[#0F9D58]" />
          </div>
        </section>

        {/* Service grid */}
        <section className="max-w-5xl mx-auto px-4 mt-9 pb-8">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm">
              No services match your search or filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}
        </section>

        {/* CTA banner */}
        <CtaBanner />
      </main>

      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function FilterRow({ label, children, className = "" }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-start rp-filter-row ${className}`}
    >
      <span className="font-['Inter'] font-semibold text-[12px] leading-[12px] tracking-[0.6px] uppercase text-[#0B1C30] mr-1">
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[13px] px-3.5 py-1.5 rounded-full border transition whitespace-nowrap ${
        active
          ? "bg-[#0F9D58] border-[#0F9D58] text-white font-medium"
          : "bg-white border-slate-200 text-slate-700 font-normal hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function ServiceCard({ service }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative h-44">
        <img
          src={service.image}
          alt={service.title}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-3 left-3 bg-[#0F9D58] text-white text-[11px] font-semibold px-2.5 py-1 rounded-md">
          {service.tag}
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-[#0F9D58] mb-2">
          <img src={imgTick} alt="tick" className="w-3.5 h-3.5 shrink-0" />
          <span className="font-['Inter'] font-semibold text-[12px] leading-[12px] tracking-[0.6px] uppercase text-[#12B14E] whitespace-nowrap">
            VERIFIED PROFESSIONAL
          </span>
          <span className="ml-1 bg-[#12B14E4F] text-[#0F9D58] px-1.5 py-0.5 rounded text-[10px]">
            ECO4
          </span>
          <span className="bg-[#12B14E4F] text-[#0F9D58] px-1.5 py-0.5 rounded text-[10px]">
            GBIS
          </span>
        </div>

        <h3 className="font-bold text-[15px] leading-snug mb-1.5">
          {service.title}
        </h3>
        <p className="text-sm text-slate-500 flex-1">{service.description}</p>

        <div className="flex items-center justify-between mt-4 mb-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={14} />
            {service.duration}
          </span>
          <span className="text-right">
            <span className="block text-[10px] font-semibold text-slate-400">
              FROM
            </span>
            <span className="text-lg font-bold text-[#0B1E36]">
              £{service.price}
            </span>
          </span>
        </div>

        <Link
          to={`/services/${service.id}`}
          className="ps-view-btn text-center mx-auto text-sm hover:opacity-90 transition"
        >
          <span className="ps-view-btn-label">
            View Details
          </span>
        </Link>
      </div>
    </div>
  );
}


