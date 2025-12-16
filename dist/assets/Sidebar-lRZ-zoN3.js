function b(i){if(document.getElementById("logo-sidebar"))return;const c=i.map((e,d)=>`
    <li>
       <a href="#" id="${e.id}" class="flex items-center p-2 text-white rounded-lg hover:bg-blue-500 group transition-colors duration-200">
          ${e.icon||'<svg class="w-5 h-5 text-white transition duration-75 group-hover:text-gray-200" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0z"/></svg>'}
          <span class="ms-3 font-medium text-white">${e.label}</span>
       </a>
    </li>
  `).join(""),s='<div id="sidebar-backdrop" class="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 dark:bg-opacity-80 hidden sm:hidden transition-opacity duration-300"></div>',n=`
    <aside id="logo-sidebar" class="fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform -translate-x-full bg-gradient-to-b from-blue-600 to-blue-700 border-r border-blue-800 sm:translate-x-0" aria-label="Sidebar">
       <div class="h-full px-3 pb-4 overflow-y-auto bg-gradient-to-b from-blue-600 to-blue-700">
          <ul class="space-y-2 font-medium">
             ${c}
          </ul>
       </div>
    </aside>
    
    <!-- Spacer untuk desktop agar main content tidak tertutup sidebar -->
    <div id="sidebar-spacer" class="hidden sm:block sm:w-64"></div>
  `,o=document.getElementById("main-navbar");o?o.insertAdjacentHTML("afterend",n+s):document.body.insertAdjacentHTML("afterbegin",n+s);const t=document.getElementById("sidebar-backdrop"),a=document.getElementById("logo-sidebar");setTimeout(()=>{const e=document.getElementById("sidebar-toggle");e&&a?e.addEventListener("click",()=>{console.log("🔘 Toggle clicked"),a.classList.toggle("-translate-x-full"),t&&t.classList.toggle("hidden")}):console.warn("⚠️ Toggle button or sidebar not found:",{toggleBtn:e,sidebar:a})},100),t&&t.addEventListener("click",()=>{a&&a.classList.add("-translate-x-full"),t.classList.add("hidden")}),i.forEach(e=>{const d=document.getElementById(e.id);d&&d.addEventListener("click",l=>{l.preventDefault(),document.querySelectorAll("#logo-sidebar a").forEach(r=>{r.classList.remove("bg-blue-800"),r.classList.add("text-white")}),d.classList.add("bg-blue-800"),d.classList.add("text-white"),e.onClick&&e.onClick(l),window.innerWidth<640&&(document.getElementById("logo-sidebar").classList.add("-translate-x-full"),t&&t.classList.add("hidden"))})})}export{b as r};
