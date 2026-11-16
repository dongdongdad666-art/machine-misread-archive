import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { navigation } from "./navigation";
import { ArchiveDetailPage } from "../pages/ArchiveDetailPage";
import { ArchivePage } from "../pages/ArchivePage";
import { HomePage } from "../pages/HomePage";
import { ChallengePage } from "../pages/ChallengePage";
import { ObservationPage } from "../pages/ObservationPage";

const CaseStudyPage = lazy(() => import("../pages/CaseStudyPage").then((module) => ({
  default: module.CaseStudyPage,
})));
const GovernancePage = lazy(() => import("../pages/GovernancePage").then((module) => ({
  default: module.GovernancePage,
})));
const CreatePage = lazy(() => import("../pages/CreatePage").then((module) => ({
  default: module.CreatePage,
})));

export function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="机器误读档案馆首页">
          <span aria-hidden="true" className="brand-mark">误</span>
          <span>机器误读档案馆</span>
        </Link>
        <nav aria-label="主要导航">
          {navigation.map((item) => (
            <Link key={item.href} to={item.href}>{item.label}</Link>
          ))}
        </nav>
      </header>

      <main>
        <Suspense fallback={<p className="route-loading" role="status">正在调取档案…</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/archive/:id" element={<ArchiveDetailPage />} />
            <Route path="/challenge/:id" element={<ChallengePage />} />
            <Route path="/observation" element={<ObservationPage />} />
            <Route path="/governance" element={<GovernancePage />} />
            <Route path="/case-study" element={<CaseStudyPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
