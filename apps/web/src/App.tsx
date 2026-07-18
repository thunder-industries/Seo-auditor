import { useState } from "react";
import { PageAuditView } from "./components/PageAuditView";
import { SiteAuditView } from "./components/SiteAuditView";

type Tab = "page" | "site";

function App() {
  const [tab, setTab] = useState<Tab>("page");

  return (
    <div className="app">
      <header className="app__header">
        <h1>SEO Auditor</h1>
        <nav className="tabs">
          <button className={tab === "page" ? "tabs__tab tabs__tab--active" : "tabs__tab"} onClick={() => setTab("page")}>
            Page audit
          </button>
          <button className={tab === "site" ? "tabs__tab tabs__tab--active" : "tabs__tab"} onClick={() => setTab("site")}>
            Site audit
          </button>
        </nav>
      </header>

      <main className="app__main">{tab === "page" ? <PageAuditView /> : <SiteAuditView />}</main>
    </div>
  );
}

export default App;
