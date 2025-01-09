//scroll data in table
$(window).on("load resize ", function() {
    var scrollWidth = $('.tbl-content').width() - $('.tbl-content table').width();
    $('.tbl-header').css({'padding-right':scrollWidth});
    }).resize();
//Load data table

document.getElementById('filter').addEventListener('click', function() {
    // Lấy giá trị từ các input
    const line = document.getElementById('line').value.trim();
    const time_update = document.getElementById('time_update').value.trim();
    const time_end = document.getElementById('time_end').value.trim();
    const state = document.getElementById('state').value.trim();
    const payload = {
        line: line !== '' ? line : null,
        time_update: time_update !== '' ? time_update : null,
        time_end: time_end !== '' ? time_end : null,
        state: state !== '' ? state : null
    };
    document.getElementById('loading').style.display = 'block'; 
    fetch('/filter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const tableBody = document.getElementById('result-table').querySelector('.tbl-content tbody');
            tableBody.innerHTML = '';

            // Lặp qua kết quả và thêm hàng vào bảng
            data.data.forEach(record => {
                const stateClass = record.state === 'PASS' ? 'state-pass' : 'state-fail';
                const row = `
                    <tr>
                        <td>${record.stt}</td>
                        <td>${record.line}</td>
                        <td>${record.name_machine}</td>
                        <td>${record.force_1}</td>
                        <td>${record.force_2}</td>
                        <td>${record.force_3}</td>
                        <td>${record.force_4}</td>
                        <td>${record.time_update}</td>
                        <td class="${stateClass}">${record.state}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });

            console.log("Dữ liệu đã được tải vào bảng");
        } else {
            alert('Không tìm thấy dữ liệu!');
        }
        // Ẩn spinner sau khi nhận kết quả
    document.getElementById('loading').style.display = 'none';
    })
    .catch(error => console.error('Lỗi:', error));
});
//Loading data 
async function fetchData(page) {
    // Hiển thị GIF khi bắt đầu tải dữ liệu
    document.getElementById("loading").style.display = "block";
  
    try {
      const response = await fetch(`/data?page=${page}`);
      const data = await response.json();
      
      // Xử lý và hiển thị dữ liệu
      console.log(data);
  
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      // Ẩn GIF khi đã tải xong dữ liệu
      document.getElementById("loading").style.display = "none";
    }
  } 
  // load patirion
  document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");

    // Hàm tải dữ liệu trang
    function fetchPage(page = 1) {
        fetch(`/dashboard?page=${page}`, {
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.data) {
                    updateTable(data.data);
                    updatePagination(data.page, data.total_pages, data.group_start, data.group_end);
                } else {
                    tableBody.innerHTML = `<tr><td colspan="9">Không tìm thấy dữ liệu.</td></tr>`;
                }
            })
            .catch(error => {
                console.error("Error fetching page data:", error);
                tableBody.innerHTML = `<tr><td colspan="9">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
            });
    }

    // Hàm cập nhật bảng
    function updateTable(rows) {
        tableBody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.stt}</td>
                <td>${row.line}</td>
                <td>${row.name_machine}</td>
                <td>${row.force_1}</td>
                <td>${row.force_2}</td>
                <td>${row.force_3}</td>
                <td>${row.force_4}</td>
                <td>${row.time_update}</td>
                <td>${row.state}</td>
            </tr>
        `).join("");
    }

    // Hàm cập nhật phân trang
    function updatePagination(currentPage, totalPages, groupStart, groupEnd) {
        paginationDiv.innerHTML = "";

        // Nút "Lùi"
        if (currentPage > 1) {
            paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
        }

        // Các số trang
        for (let i = groupStart; i <= groupEnd; i++) {
            paginationDiv.innerHTML += `
                <a href="#" class="page-link ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</a>
            `;
        }

        // Nút "Tiến"
        if (currentPage < totalPages) {
            paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage + 1}">&raquo;</a>`;
        }

        bindPaginationEvents();
    }

    // Gắn sự kiện click cho các liên kết phân trang
    function bindPaginationEvents() {
        const links = paginationDiv.querySelectorAll(".page-link");
        links.forEach(link => {
            link.addEventListener("click", function (event) {
                event.preventDefault();
                const page = parseInt(this.getAttribute("data-page"), 10);
                if (!isNaN(page)) {
                    fetchPage(page);
                }
            });
        });
    }
    fetchPage();
});

