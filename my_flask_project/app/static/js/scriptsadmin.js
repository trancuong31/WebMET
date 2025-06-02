document.addEventListener('DOMContentLoaded', function () {
    setupNavLinks();
    observeCards();
    loadSolutionData();
    loadUserData();
    loadUserCount();
});
function setupNavLinks() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function observeCards() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.card, .review-card, .chart-card').forEach(card => {
        observer.observe(card);
    });
}

function loadSolutionData() {
    fetch('/api/getDataSolution')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('tbodySolution');
            tbody.innerHTML = '';

            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.error_code}</td>
                    <td>${item.error_name}</td>
                    <td>${item.root_cause.replace(/\./g, '.<br>')}</td>
                    <td>${item.solution}</td>
                    <td>
                        <input type="checkbox" class="active-toggle" data-id="${item.error_code}" ${item.active ? 'checked' : ''}>
                    </td>
                `;
                tbody.appendChild(row);
            });

            attachToggleEvent('.active-toggle', 'error_code', 'active', '/api/updateActiveStatus');
        })
        .catch(error => {
            console.error('Lỗi khi lấy dữ liệu từ /api/getDataSolution:', error);
        });
}

function loadUserData() {
    fetch('/api/getusers')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('tbodyuser');
            tbody.innerHTML = '';

            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.username}</td>
                    <td>${item.email}</td>
                    <td>${item.account_status}</td>
                    <td>${item.role}</td>
                    <td>
                        <input type="checkbox" class="status-toggle" data-id="${item.username}" ${item.account_status === 'active' ? 'checked' : ''}>
                    </td>
                `;
                tbody.appendChild(row);
            });

            attachToggleEvent('.status-toggle', 'username', 'account_status', '/api/updateAccountStatus', v => v ? 'active' : 'inactive');
        })
        .catch(error => {
            console.error('Lỗi khi lấy dữ liệu user:', error);
        });
}
function loadUserCount() {
    fetch('/api/sumuser')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const sum = document.querySelector('.card-value');
            if (sum && data.total_users !== undefined) {
                sum.textContent = data.total_users;
            }
        })
        .catch(error => {
            console.error('Error fetching user count:', error);
        });
}

function attachToggleEvent(selector, idField, valueField, endpoint, transformValue = v => v ? 1 : 0) {
    document.querySelectorAll(selector).forEach(toggle => {
        toggle.addEventListener('change', function () {
            const idValue = this.dataset.id;
            const value = transformValue(this.checked);

            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idField]: idValue, [valueField]: value })
            })
                .then(response => response.json())
                .then(result => {
                    console.log('Cập nhật thành công:', result);
                })
                .catch(error => {
                    console.error(`Lỗi khi cập nhật ${valueField}:`, error);
                });
        });
    });
}
