function r({title:n,userEmail:e,onLogout:t}){if(document.getElementById("main-navbar"))return;const a=`
    <nav id="main-navbar" class="fixed top-0 z-50 w-full bg-gradient-to-r from-blue-600 to-blue-700 shadow-md">
      <div class="px-3 py-3 lg:px-5 lg:pl-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center justify-start rtl:justify-end">
            <button id="sidebar-toggle" aria-controls="logo-sidebar" type="button" class="inline-flex items-center p-2 text-sm text-white rounded-lg sm:hidden hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300">
                <span class="sr-only">Open sidebar</span>
                <svg class="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                   <path clip-rule="evenodd" fill-rule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"></path>
                </svg>
             </button>
            <a href="#" class="flex ms-2 md:ms-4">
              <img src="./assets/logo.png" class="h-8 me-3 rounded-full shadow-sm" alt="Logo" onerror="this.src='https://ui-avatars.com/api/?name=S+S&background=random'"/>
              <span class="self-center text-xl font-semibold sm:text-2xl whitespace-nowrap text-white">${n}</span>
            </a>
          </div>
          <div class="flex items-center">
              <div class="flex items-center ms-3">
                <div class="flex items-center gap-3">
                    <span class="hidden sm:block text-sm text-white font-medium">${e||"User"}</span>
                    <button type="button" class="flex text-sm bg-gray-800 rounded-full focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600" aria-expanded="false" data-dropdown-toggle="dropdown-user">
                      <span class="sr-only">Open user menu</span>
                      <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold">
                        ${(e||"U").charAt(0).toUpperCase()}
                      </div>
                    </button>
                    <button id="nav-logout-btn" class="text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-xs px-3 py-1.5 text-center dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-800 ml-2">Logout</button>
                </div>
              </div>
            </div>
        </div>
      </div>
    </nav>
  `;document.body.insertAdjacentHTML("afterbegin",a);const s=document.getElementById("nav-logout-btn");s&&t&&s.addEventListener("click",t)}export{r};
