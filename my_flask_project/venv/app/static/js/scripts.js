//scroll data in table
$(window).on("load resize ", function() {
    var scrollWidth = $('.tbl-content').width() - $('.tbl-content table').width();
    $('.tbl-header').css({'padding-right':scrollWidth});
    }).resize();
//Load data table
//filter data
// document.getElementById('filter').addEventListener('click', function() {
//     // Lấy giá trị từ các input
//     const line = document.getElementById('line').value.trim();
//     const time_update = document.getElementById('time_update').value.trim();
//     const time_end = document.getElementById('time_end').value.trim();
//     const state = document.getElementById('state').value.trim();

//     const formatDatetime = (datetime) => {
//         return datetime ? datetime.replace('T', ' ') + ':00' : null; // Thêm giây để phù hợp định dạng 'YYYY-MM-DD HH:MM:SS'
//     };
//     const payload = {
//         line: line !== '' ? line : null,
//         time_update: formatDatetime(time_update),
//         time_end: formatDatetime(time_end),
//         state: state !== '' ? state : null
//     };
//     document.getElementById('loading').style.display = 'block'; 
//     fetch('/filter', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(payload)
//     })
//     .then(response => response.json())
//     .then(data => {
//         if (data.success) {
//             const tableBody = document.getElementById('result-table').querySelector('.tbl-content tbody');
//             tableBody.innerHTML = '';
//             data.data.forEach(record => {
//                 const stateClass = record.state === 'PASS' ? 'state-pass' : 'state-fail';
//                 const row = `
//                     <tr>
//                         <td>${record.stt}</td>
//                         <td>${record.factory}</td>
//                         <td>${record.line}</td>
//                         <td>${record.serial_number}</td>
//                         <td>${record.model_name}</td>
//                         <td>${record.name_machine}</td>
//                         <td>${record.force_1}</td>
//                         <td>${record.force_2}</td>
//                         <td>${record.force_3}</td>
//                         <td>${record.force_4}</td>
//                         <td>${record.time_update}</td>
//                         <td class="${stateClass}">${record.state}</td>
//                     </tr>
//                 `;
//                 tableBody.innerHTML += row;
//             });

//             console.log("Dữ liệu đã được tải vào bảng");
//         } else {
//             alert('Không tìm thấy dữ liệu!');
//         }
//     document.getElementById('loading').style.display = 'none';
//     })
//     .catch(error => console.error('Lỗi:', error));
// });

document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");

    // Xử lý sự kiện filter
    document.getElementById('filter').addEventListener('click', function () {
        this.dataset.filtering = 'true'; 
        fetchFilteredData(1); 
    });

    // Hàm gọi API filter
    function fetchFilteredData(page = 1) {
        // Lấy giá trị từ các input
        const line = document.getElementById('line').value.trim();
        const time_update = document.getElementById('time_update').value.trim();
        const time_end = document.getElementById('time_end').value.trim();
        const state = document.getElementById('state').value.trim();

        const formatDatetime = (datetime) => {
            return datetime ? datetime.replace('T', ' ') + ':00' : null;
        };

        const payload = {
            line: line || null,
            time_update: formatDatetime(time_update),
            time_end: formatDatetime(time_end),
            state: state || null,
            page: page,
            per_page: 10 
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
                    updateTable(data.data);
                    updatePagination(data.current_page, data.total_pages, data.group_start, data.group_end);
                } else {
                    tableBody.innerHTML = `<tr><td colspan="12">Không tìm thấy dữ liệu.</td></tr>`;
                    paginationDiv.innerHTML = '';
                }
                document.getElementById('loading').style.display = 'none';
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
                    <td>${row.serial_number}</td>
                    <td>${row.model_name}</td>
                    <td>${row.name_machine}</td>
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

    // Hàm cập nhật phân trang
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
                event.preventDefault();
                const page = parseInt(this.getAttribute("data-page"), 10);
                if (!isNaN(page)) {
                    if (document.getElementById('filter').dataset.filtering === 'true') {
                        fetchFilteredData(page); // Gọi filter nếu đang lọc
                    } else {
                        fetchPage(page); // Gọi dashboard nếu không lọc
                    }
                }
            });
        });
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");

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
        tableBody.innerHTML = rows.map(row => {
            const stateClass = row.state === 'PASS' ? 'state-pass' : 'state-fail';

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
                    <td class="${stateClass}">${row.state}</td>
                </tr>
            `;
        }).join("");
    }

    // Hàm cập nhật phân trang
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
document.addEventListener("DOMContentLoaded", function () {
    // DOM elements
    const totalRecords = document.getElementById("total-records");
    const outputPass = document.getElementById("pass-records");
    const failRecords = document.getElementById("fail-records");
    const fpyPercentage = document.getElementById("fpy-percentage");

    // Fetch data from the `/getinfo` endpoint
    document.getElementById('loading').style.display = 'block'; 
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
            // Update the DOM elements with the fetched data
            totalRecords.textContent = data.total;
            outputPass.textContent = data.output;
            failRecords.textContent = data.fail;
            fpyPercentage.textContent = `${data.fpy.toFixed(2)}%`;
        })
        
        .catch(error => {
            console.error("Error fetching data:", error);
            totalRecords.textContent = "Error loading data";
            outputPass.textContent = "Error loading data";
            failRecords.textContent = "Error loading data";
            fpyPercentage.textContent = "Error loading data";
        });
        document.getElementById('loading').style.display = 'none';
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
            line: document.getElementById("line").value.trim() || null,
            time_update: formatDatetime(document.getElementById("time_update").value),
            time_end: formatDatetime(document.getElementById("time_end").value),
            state: document.getElementById("state").value || null
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





