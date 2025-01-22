//scroll data in table
$(window).on("load resize ", function() {
    var scrollWidth = $('.tbl-content').width() - $('.tbl-content table').width();
    $('.tbl-header').css({'padding-right':scrollWidth});
    }).resize();
//filter data
document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");

    // Xử lý sự kiện filter
    document.getElementById('filter').addEventListener('click', function () {
        event.preventDefault();
        this.dataset.filtering = 'true'; 
        fetchFilteredData(1); 
    });

    function fetchFilteredData(page = 1) {
        // Lấy giá trị từ các input
        const line = document.getElementById('line-combobox').value.trim();
        const factory = document.getElementById('factory-combobox').value.trim();
        const time_update = document.getElementById('time_update').value.trim();
        const time_end = document.getElementById('time_end').value.trim();
        const state = document.getElementById('state-combobox').value.trim();
        const nameMachine = document.getElementById('nameMachine-combobox').value.trim();
        const formatDatetime = (datetime) => {
            return datetime ? datetime.replace('T', ' ') + ':00' : null;
        };

        const payload = {
            line: line || null,
            factory: factory || null,
            nameMachine: nameMachine||null,
            time_update: formatDatetime(time_update),
            time_end: formatDatetime(time_end),
            state: state || null,
            page: page,
            per_page: 10 
        };

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
                    document.getElementById('count').textContent = data.message ||""
                    updateTable(data.data);
                    updatePagination(data.current_page, data.total_pages, data.group_start, data.group_end);
                    if (data.total_records == 0){
                        tableBody.innerHTML = `<tr><td colspan="12">No data found.</td></tr>`;
                        paginationDiv.innerHTML = '';
                    }
                } else {
                    tableBody.innerHTML = `<tr><td colspan="12">No data found.</td></tr>`;
                    paginationDiv.innerHTML = '';
                }
            })
            .catch(error => {
                console.error("Error fetching filtered data:", error);
                tableBody.innerHTML = `<tr><td colspan="12">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
                paginationDiv.innerHTML = '';
                document.getElementById('loading').style.display = 'none';
            });
    }

    // Hàm cập nhật bảng
    function updateTable(rows) {
        tableBody.innerHTML = rows.map(row => {
            const stateClass = row.state === 'PASS' ? 'state-pass' : 'state-fail';

            return `
                <tr>
                    <td>${row.stt}</td>
                    <td>${row.factory}</td>
                    <td>${row.line}</td>
                    <td>${row.name_machine}</td>
                    <td>${row.model_name}</td>
                    <td>${row.serial_number}</td>
                    <td>${row.force_1}</td>
                    <td>${row.force_2}</td>
                    <td>${row.force_3}</td>
                    <td>${row.force_4}</td>
                    <td>${row.time_update}</td>
                    <td class="${stateClass}">${row.state}</td>
                </tr>
            `;
        }).join("");
    }

    function updatePagination(currentPage, totalPages, groupStart, groupEnd) {
        paginationDiv.innerHTML = "";

        if (currentPage > 1) {
            paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
        }

        for (let i = groupStart; i <= groupEnd; i++) {
            paginationDiv.innerHTML += `
                <a href="#" class="page-link ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</a>
            `;
        }

        if (currentPage < totalPages) {
            paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage + 1}">&raquo;</a>`;
        }

        bindPaginationEvents();
    }
    // Gắn sự kiện click phân trang
    function bindPaginationEvents() {
        const links = paginationDiv.querySelectorAll(".page-link");
        links.forEach(link => {
            link.addEventListener("click", function (event) {
                event.preventDefault(); // Ngăn trình duyệt refresh
    
                const page = parseInt(this.getAttribute("data-page"), 10);
                if (!isNaN(page)) {
                    // Kiểm tra trạng thái lọc hay dashboard
                    if (document.getElementById('filter').dataset.filtering === 'true') {
                        fetchFilteredData(page);
                    } else {
                        fetchPage(page);
                    }
                }
            });
        });
    }
    
});

document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");
    const POLLING_INTERVAL = 60000; // 60s

    let currentPage = 1;
    let pollingTimer;

    // Hàm gọi API dashboard
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
                document.getElementById('count').textContent =""
                updatePagination(data.page, data.total_pages, data.group_start, data.group_end);
            } else {
                tableBody.innerHTML = `<tr><td colspan="12">Không tìm thấy dữ liệu.</td></tr>`;
                paginationDiv.innerHTML = '';
            }
        })
        .catch(error => {
            console.error("Error fetching page data:", error);
            tableBody.innerHTML = `<tr><td colspan="12">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
            paginationDiv.innerHTML = '';
        });
    }

    // Hàm cập nhật bảng
    function updateTable(rows) {
        tableBody.innerHTML = "";
        const tableRows = rows.map(row => {
            return `
                <tr>
                    <td>${row.stt}</td>
                    <td>${row.factory}</td>
                    <td>${row.line}</td>
                    <td>${row.serial_number}</td>
                    <td>${row.model_name}</td>
                    <td>${row.name_machine}</td>
                    <td>${row.force_1}</td>
                    <td>${row.force_2}</td>
                    <td>${row.force_3}</td>
                    <td>${row.force_4}</td>
                    <td>${row.time_update}</td>
                    <td class="${row.state === 'PASS' ? 'state-pass' : 'state-fail'}">${row.state}</td>
                </tr>
            `;
        }).join("");
        tableBody.innerHTML = tableRows;
    }

    // Hàm cập nhật phân trang
    function updatePagination(currentPage, totalPages, groupStart, groupEnd) {
        let paginationHTML = "";

        if (currentPage > 1) {
            paginationHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
        }

        for (let i = groupStart; i <= groupEnd; i++) {
            paginationHTML += `
                <a href="#" class="page-link ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</a>
            `;
        }

        if (currentPage < totalPages) {
            paginationHTML += `<a href="#" class="page-link" data-page="${currentPage + 1}">&raquo;</a>`;
        }

        paginationDiv.innerHTML = paginationHTML;
        bindPaginationEvents();
    }

    // Gắn sự kiện click phân trang
    function bindPaginationEvents() {
        const links = paginationDiv.querySelectorAll(".page-link");
        links.forEach(link => {
            link.addEventListener("click", function (event) {
                event.preventDefault();
                const page = parseInt(this.getAttribute("data-page"), 10);
                if (!isNaN(page)) {
                    currentPage = page;
                    fetchPage(page);
                }
            });
        });
    }
    function startPolling() {
        fetchPage(currentPage); 
        pollingTimer = setInterval(() => {
            fetchPage(currentPage);
        }, POLLING_INTERVAL);
    }
    function stopPolling() {
        clearInterval(pollingTimer);
    }
    startPolling();
});


/*websocket*/
/*document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");

    // Kết nối tới WebSocket server
    const socket = io();

    // Gửi yêu cầu dữ liệu ban đầu
    socket.emit('request_data', { page: 1, per_page: 10 });

    // Nhận dữ liệu và cập nhật giao diện
    socket.on('update_dashboard', function (data) {
        if (data.error) {
            console.error("Error:", data.error);
            tableBody.innerHTML = `<tr><td colspan="12">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
            return;
        }

        // Cập nhật bảng
        updateTable(data.data);

        // Cập nhật phân trang
        updatePagination(data.page, data.total_pages);
    });

    // Hàm cập nhật bảng
    function updateTable(rows) {
        tableBody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.stt}</td>
                <td>${row.factory}</td>
                <td>${row.line}</td>
                <td>${row.serial_number}</td>
                <td>${row.model_name}</td>
                <td>${row.name_machine}</td>
                <td>${row.force_1}</td>
                <td>${row.force_2}</td>
                <td>${row.force_3}</td>
                <td>${row.force_4}</td>
                <td>${row.time_update}</td>
                <td class="${row.state === 'PASS' ? 'state-pass' : 'state-fail'}">${row.state}</td>
            </tr>
        `).join('');
    }

    // Hàm cập nhật phân trang
function updatePagination(currentPage, totalPages) {
    paginationDiv.innerHTML = "";

    const maxVisiblePages = 5; // Số trang hiển thị tối đa
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Điều chỉnh lại nếu endPage chạm giới hạn tổng số trang
    if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Nút Previous
    if (currentPage > 1) {
        paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
    }

    // Hiển thị các trang trong khoảng [startPage, endPage]
    for (let i = startPage; i <= endPage; i++) {
        paginationDiv.innerHTML += `
            <a href="#" class="page-link ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</a>
        `;
    }

    // Nút Next
    if (currentPage < totalPages) {
        paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage + 1}">&raquo;</a>`;
    }

    // Gắn sự kiện cho các liên kết
    bindPaginationEvents();
}


    // Gắn sự kiện phân trang
    function bindPaginationEvents() {
        const links = paginationDiv.querySelectorAll(".page-link");
        links.forEach(link => {
            link.addEventListener("click", function (event) {
                event.preventDefault();
                const page = parseInt(this.getAttribute("data-page"), 10);
                if (!isNaN(page)) {
                    socket.emit('request_data', { page: page, per_page: 10 });
                }
            });
        });
    }
});
*/
























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
// load table
//   document.addEventListener("DOMContentLoaded", function () {
//     const tableBody = document.getElementById("table-body");
//     const paginationDiv = document.getElementById("pagination");

//     // Hàm tải dữ liệu trang
//     function fetchPage(page = 1) {
//         fetch(`/dashboard?page=${page}`, {
//             headers: {
//                 "X-Requested-With": "XMLHttpRequest"
//             }
//         })
//             .then(response => response.json())
//             .then(data => {
//                 if (data.data) {
//                     updateTable(data.data);
//                     updatePagination(data.page, data.total_pages, data.group_start, data.group_end);
//                 } else {
//                     tableBody.innerHTML = `<tr><td colspan="9">Không tìm thấy dữ liệu.</td></tr>`;
//                 }
//             })
//             .catch(error => {
//                 console.error("Error fetching page data:", error);
//                 tableBody.innerHTML = `<tr><td colspan="9">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
//             });
//     }

//     // Hàm cập nhật bảng
//     function updateTable(rows) {
//         tableBody.innerHTML = rows.map(row => {
//             // Xác định lớp CSS cho trạng thái
//             const stateClass = row.state === 'PASS' ? 'state-pass' : 'state-fail';
    
//             return `
//                 <tr>
//                     <td>${row.stt}</td>
//                     <td>${row.factory}</td>
//                     <td>${row.line}</td>
//                     <td>${row.serial_number}</td>
//                     <td>${row.model_name}</td>
//                     <td>${row.name_machine}</td>
//                     <td>${row.force_1}</td>
//                     <td>${row.force_2}</td>
//                     <td>${row.force_3}</td>
//                     <td>${row.force_4}</td>
//                     <td>${row.time_update}</td>
//                     <td class="${stateClass}">${row.state}</td>
//                 </tr>
//             `;
//         }).join("");
//     }
    

//     // Hàm cập nhật phân trang
//     function updatePagination(currentPage, totalPages, groupStart, groupEnd) {
//         paginationDiv.innerHTML = "";

//         // Nút "Lùi"
//         if (currentPage > 1) {
//             paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
//         }

//         // Các số trang
//         for (let i = groupStart; i <= groupEnd; i++) {
//             paginationDiv.innerHTML += `
//                 <a href="#" class="page-link ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</a>
//             `;
//         }

//         // Nút "Tiến"
//         if (currentPage < totalPages) {
//             paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${currentPage + 1}">&raquo;</a>`;
//         }

//         bindPaginationEvents();
//     }

//     // Gắn sự kiện click cho các liên kết phân trang
//     function bindPaginationEvents() {
//         const links = paginationDiv.querySelectorAll(".page-link");
//         links.forEach(link => {
//             link.addEventListener("click", function (event) {
//                 event.preventDefault();
//                 const page = parseInt(this.getAttribute("data-page"), 10);
//                 if (!isNaN(page)) {
//                     if (document.getElementById('filter').dataset.filtering === 'true') {
//                         fetchFilteredData(page); // Gọi filter nếu đang lọc
//                     } else {
//                         fetchPage(page); // Gọi dashboard mặc định
//                     }
//                 }
//             });
//         });
//     }
//     fetchPage();
// });

//get total info

/*load info overview*/
// document.addEventListener("DOMContentLoaded", function () {
//     // DOM elements
//     const totalRecords = document.getElementById("total-records");
//     const outputPass = document.getElementById("pass-records");
//     const failRecords = document.getElementById("fail-records");
//     const fpyPercentage = document.getElementById("fpy-percentage");
//     const POLLING_INTERVAL = 5000;
//     // Fetch data from the `/getinfo` endpoint
//     document.getElementById('loading').style.display = 'block'; 
//     fetch("/getinfo", {
//         method: "GET",
//         headers: {
//             "X-Requested-With": "XMLHttpRequest"
//         }
//     })
//         .then(response => {
//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }
//             return response.json();
//         })
//         .then(data => {
//             // Update the DOM elements with the fetched data
//             totalRecords.textContent = data.total;
//             outputPass.textContent = data.output;
//             failRecords.textContent = data.fail;
//             fpyPercentage.textContent = `${data.fpy.toFixed(2)}%`;
//         })
//         .catch(error => {
//             console.error("Error fetching data:", error);
//             totalRecords.textContent = "Error loading data";
//             outputPass.textContent = "Error loading data";
//             failRecords.textContent = "Error loading data";
//             fpyPercentage.textContent = "Error loading data";
//         }).finally(() => {
//             setTimeout(() => fetchPage(currentPage), POLLING_INTERVAL);
//         });
//         document.getElementById('loading').style.display = 'none';
// });

document.addEventListener("DOMContentLoaded", function () {
    // DOM elements
    const totalRecords = document.getElementById("total-records");
    const outputPass = document.getElementById("pass-records");
    const failRecords = document.getElementById("fail-records");
    const fpyPercentage = document.getElementById("fpy-percentage");
    // const loadingIndicator = document.getElementById('loading');
    const POLLING_INTERVAL = 300000; 

    function fetchContentTop() {
        // loadingIndicator.style.display = 'block';

        fetch("/getinfo", {
            method: "GET",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                totalRecords.textContent = data.total || "N/A";
                outputPass.textContent = data.output || "N/A";
                failRecords.textContent = data.fail || "N/A";
                fpyPercentage.textContent = `${data.fpy?.toFixed(2) || "N/A"}%`;
            })
            .catch(error => {
                console.error("Error fetching data:", error);
                totalRecords.textContent = "Error";
                outputPass.textContent = "Error";
                failRecords.textContent = "Error";
                fpyPercentage.textContent = "Error";
            })
            .finally(() => {
                // loadingIndicator.style.display = 'none'; 
                setTimeout(fetchContentTop, POLLING_INTERVAL); 
            });
    }

    // Initial load
    fetchContentTop();
});


//download excel
document.addEventListener("DOMContentLoaded", function () {
    const downloadButton = document.getElementById('download-excel');
    
    // Xóa sự kiện cũ (nếu có)
    downloadButton.removeEventListener('click', handleDownload);

    // Gắn sự kiện mới
    downloadButton.addEventListener('click', handleDownload);

    async function handleDownload(event) {
        event.preventDefault();
        const formatDatetime = (datetime) => {
            return datetime ? datetime.replace('T', ' ') + ':00' : null;
        };
        const payload = {
            line: document.getElementById("line-combobox").value.trim() || null,
            time_update: formatDatetime(document.getElementById("time_update").value),
            time_end: formatDatetime(document.getElementById("time_end").value),
            state: document.getElementById("state-combobox").value || null
        };

        try {
            const response = await fetch('/downloadExcel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `filtered_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading Excel:", error);
            alert("Failed to download the Excel file. Please try again.");
        }
    }
}); 
//get lines, states
document.addEventListener("DOMContentLoaded", function () {
    const lineCombobox = document.getElementById("line-combobox");
    const factoryCombobox = document.getElementById("factory-combobox");
    const stateCombobox = document.getElementById("state-combobox");
    const nameMachineCombobox = document.getElementById("nameMachine-combobox");
    
    // Fetch data from /getLines
    fetch("/getLines")
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            lineCombobox.innerHTML = '<option value="">All</option>';
            data.lines.forEach(line => {
                const option = document.createElement("option");
                option.value = line;
                option.textContent = line;
                lineCombobox.appendChild(option);
            });
            factoryCombobox.innerHTML = '<option value="">All</option>';
            data.factories.forEach(factory => {
                const option = document.createElement("option");
                option.value = factory;
                option.textContent = factory;
                factoryCombobox.appendChild(option);
            });
            stateCombobox.innerHTML = '<option value="">All</option>';
            data.states.forEach(state => {
                const option = document.createElement("option");
                option.value = state;
                option.textContent = state;
                stateCombobox.appendChild(option);
            });

            nameMachineCombobox.innerHTML = '<option value="">All</option>';
            data.nameMachines.forEach(nameMachine => {
                const option = document.createElement("option");
                option.value = nameMachine;
                option.textContent = nameMachine;
                nameMachineCombobox.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Error fetching lines and states:", error);
        });
});

//full screen
document.getElementById("toggle_fullscreen").addEventListener("click", function (e) {
    e.preventDefault();
    const fullscreenIcon = document.getElementById("fullscreenic");
    const container = document.documentElement;
    if (document.fullscreenElement) {
        document.exitFullscreen();
        fullscreenIcon.src = "/static/images/fullscreen1.png";
    } else {
        container.requestFullscreen();
        fullscreenIcon.src = "/static/images/disfullscreen.png";
    }
});





