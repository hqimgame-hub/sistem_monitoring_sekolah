
export const UI = {
    // LOADING OVERLAY
    showLoading: (message = 'Memproses data...') => {
        let overlay = document.getElementById("loading-overlay-global");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "loading-overlay-global";
            overlay.className = "fixed inset-0 bg-gray-900 bg-opacity-70 flex flex-col items-center justify-center z-[9999] transition-opacity duration-300 opacity-0";
            overlay.innerHTML = `
                <div class="bg-white p-5 rounded-2xl shadow-xl flex flex-col items-center animate-bounce-slow">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
                    <p id="loading-text-global" class="text-gray-700 font-semibold text-sm animate-pulse">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
            // Trigger reflow for transition
            requestAnimationFrame(() => overlay.classList.remove("opacity-0"));
        } else {
            document.getElementById("loading-text-global").textContent = message;
            overlay.classList.remove("hidden", "opacity-0");
        }
    },

    hideLoading: () => {
        const overlay = document.getElementById("loading-overlay-global");
        if (overlay) {
            overlay.classList.add("opacity-0");
            setTimeout(() => {
                overlay.classList.add("hidden");
            }, 300);
        }
    },

    // TOAST NOTIFICATIONS
    showToast: (message, type = 'success') => { // type: success, error, info, warning
        let container = document.getElementById("toast-container-global");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container-global";
            container.className = "fixed top-5 right-5 z-[10000] flex flex-col gap-3 pointer-events-none"; // pointer-events-none to let clicks pass through empty areas
            document.body.appendChild(container);
        }

        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };
        const icons = {
            success: '<i class="bi bi-check-circle-fill"></i>',
            error: '<i class="bi bi-x-circle-fill"></i>',
            info: '<i class="bi bi-info-circle-fill"></i>',
            warning: '<i class="bi bi-exclamation-triangle-fill"></i>'
        };

        const toast = document.createElement("div");
        toast.className = `${colors[type] || 'bg-gray-800'} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transform translate-x-full transition-all duration-300 pointer-events-auto min-w-[300px]`;
        toast.innerHTML = `
            <span class="text-lg">${icons[type] || ''}</span>
            <div class="flex-1 text-sm font-medium">${message}</div>
            <button onclick="this.parentElement.remove()" class="text-white hover:text-gray-200"><i class="bi bi-x"></i></button>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove("translate-x-full");
        });

        // Auto dismiss
        setTimeout(() => {
            toast.classList.add("translate-x-full", "opacity-0");
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    // CONFIRM MODAL (Promisified)
    confirm: (message) => {
        return new Promise((resolve) => {
            let overlay = document.createElement('div');
            overlay.className = "fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[10000] p-4";
            overlay.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 scale-95 opacity-0 transition-all duration-200 transform" id="confirm-modal-content">
                    <div class="text-center">
                         <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-4">
                            <i class="bi bi-question-lg text-3xl text-yellow-600"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Konfirmasi</h3>
                        <p class="text-gray-500 text-sm mb-6">${message}</p>
                        <div class="flex gap-3 justify-center">
                            <button id="btn-cancel-confirm" class="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors">Batal</button>
                            <button id="btn-ok-confirm" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/30">Ya, Lanjutkan</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Animate In
            requestAnimationFrame(() => {
                const content = overlay.querySelector('#confirm-modal-content');
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            });

            overlay.querySelector('#btn-cancel-confirm').addEventListener('click', () => {
                close();
                resolve(false);
            });

            overlay.querySelector('#btn-ok-confirm').addEventListener('click', () => {
                close();
                resolve(true);
            });

            function close() {
                const content = overlay.querySelector('#confirm-modal-content');
                content.classList.remove('scale-100', 'opacity-100');
                content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => overlay.remove(), 200);
            }
        });
    }
};
