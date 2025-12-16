
export function renderSidebar(menuItems) {
  // menuItems: Array of { id, label, icon (svg string), onClick }

  if (document.getElementById('logo-sidebar')) return;

  const menuHtml = menuItems.map((item, index) => `
    <li>
       <a href="#" id="${item.id}" class="flex items-center p-2 text-white rounded-lg hover:bg-blue-500 group transition-colors duration-200">
          ${item.icon || '<svg class="w-5 h-5 text-white transition duration-75 group-hover:text-gray-200" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0z"/></svg>'}
          <span class="ms-3 font-medium text-white">${item.label}</span>
       </a>
    </li>
  `).join('');

  // Backdrop for mobile
  const backdropHtml = `<div id="sidebar-backdrop" class="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 dark:bg-opacity-80 hidden sm:hidden transition-opacity duration-300"></div>`;

  const sidebarHtml = `
    <aside id="logo-sidebar" class="fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform -translate-x-full bg-gradient-to-b from-blue-600 to-blue-700 border-r border-blue-800 sm:translate-x-0" aria-label="Sidebar">
       <div class="h-full px-3 pb-4 overflow-y-auto bg-gradient-to-b from-blue-600 to-blue-700">
          <ul class="space-y-2 font-medium">
             ${menuHtml}
          </ul>
       </div>
    </aside>
    
    <!-- Spacer untuk desktop agar main content tidak tertutup sidebar -->
    <div id="sidebar-spacer" class="hidden sm:block sm:w-64"></div>
  `;

  // Insert sidebar after navbar or at start of body if no navbar
  const navbar = document.getElementById('main-navbar');
  if (navbar) {
    navbar.insertAdjacentHTML('afterend', sidebarHtml + backdropHtml);
  } else {
    document.body.insertAdjacentHTML('afterbegin', sidebarHtml + backdropHtml);
  }

  // Bind Events
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebar = document.getElementById('logo-sidebar');

  // Use setTimeout to ensure toggle button is rendered
  setTimeout(() => {
    const toggleBtn = document.getElementById('sidebar-toggle');

    // Mobile toggle button
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        console.log('🔘 Toggle clicked'); // Debug log
        sidebar.classList.toggle('-translate-x-full');
        if (backdrop) backdrop.classList.toggle('hidden');
      });
    } else {
      console.warn('⚠️ Toggle button or sidebar not found:', { toggleBtn, sidebar });
    }
  }, 100);

  // Backdrop click to close
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    });
  }

  menuItems.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();

        // Reset all to base state
        document.querySelectorAll('#logo-sidebar a').forEach(a => {
          a.classList.remove('bg-blue-800');
          a.classList.add('text-white'); // Force white text
        });

        // Add active state
        el.classList.add('bg-blue-800');
        el.classList.add('text-white'); // Ensure active is also white

        // Execute callback
        if (item.onClick) item.onClick(e);

        // Close sidebar on mobile after click
        if (window.innerWidth < 640) {
          document.getElementById('logo-sidebar').classList.add('-translate-x-full');
          if (backdrop) backdrop.classList.add('hidden');
        }
      });
    }
  });
}
