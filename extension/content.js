// content.js - Salesforce Page Context Scraper & Floating Sidebar Injector
let sidebarIframe = null;
let lastUrl = window.location.href;

// 1. LISTEN TO TOGGLE MESSAGE FROM BACKGROUND
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle_sidebar") {
    toggleSidebar();
  }
});

// 2. TOGGLE SIDEBAR CONTAINER
function toggleSidebar() {
  if (sidebarIframe) {
    // Remove if already exists
    sidebarIframe.remove();
    sidebarIframe = null;
    document.body.style.marginRight = "0px";
    return;
  }

  // Create iframe element
  sidebarIframe = document.createElement("iframe");
  sidebarIframe.id = "antigravity-sidebar-container";
  sidebarIframe.src = "http://localhost:5173/?embedded=true";
  
  // Style standard sidebar container floating on the right
  Object.assign(sidebarIframe.style, {
    position: "fixed",
    top: "0px",
    right: "0px",
    width: "420px",
    height: "100vh",
    border: "0px",
    zIndex: "999999",
    boxShadow: "-5px 0px 25px rgba(0,0,0,0.3)",
    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
    background: "#020617"
  });

  document.body.appendChild(sidebarIframe);
  
  // Shift Salesforce main UI slightly left for comfortable spacing
  document.body.style.marginRight = "420px";
  
  // Send initial context immediately
  setTimeout(() => {
    sendPageContext();
  }, 1000);
}

// 3. EXTRACT SALESFORCE CONTEXT METADATA
function extractSalesforceContext() {
  const url = window.location.href;
  let context = {
    type: "Home",
    url: url
  };

  // Check URL structures for standard Lightning records
  // Match format: ...lightning/r/Account/00180000000abcd/view
  const recordMatch = url.match(/lightning\/r\/([a-zA-Z0-9_]+)\/([a-zA-Z0-9]{15,18})/);
  if (recordMatch) {
    context.type = "RecordDetail";
    context.objectName = recordMatch[1];
    context.recordId = recordMatch[2];
    
    // Scrape record name from H1 or standard titles if easily accessible
    const titleEl = document.querySelector(".slds-page-header__title, h1 [data-refid='recordUi-formattedEntityName']");
    if (titleEl) {
      context.recordName = titleEl.textContent.trim();
    }
    return context;
  }

  // Check for Setup sections (Triggers, Apex classes, Flows)
  if (url.includes("lightning/setup/ApexClasses")) {
    context.type = "SetupSection";
    context.name = "ApexClassesList";
  } else if (url.includes("lightning/setup/Flows")) {
    context.type = "SetupSection";
    context.name = "FlowsList";
  } else if (url.includes("lightning/setup/ManageUsers")) {
    context.type = "SetupSection";
    context.name = "UserManagement";
  }

  return context;
}

// 4. POST CONTEXT MESSAGE INTO IFRAME
function sendPageContext() {
  if (!sidebarIframe || !sidebarIframe.contentWindow) return;

  const contextPayload = extractSalesforceContext();
  console.log("[COPILOT SCRAPER] Scraped context data:", contextPayload);
  
  // Post message to the embedded React page
  sidebarIframe.contentWindow.postMessage({
    source: "antigravity-scraper",
    context: contextPayload
  }, "*");
}

// 5. POLLING LOOP FOR NAVIGATION SHIFTS (Salesforce single-page application)
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    if (sidebarIframe) {
      sendPageContext();
    }
  }
}, 1500);
