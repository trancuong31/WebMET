//scroll data in table
$(window).on("load resize ", function() {
    var scrollWidth = $('.tbl-content').width() - $('.tbl-content table').width();
    $('.tbl-header').css({'padding-right':scrollWidth});
    }).resize();

//filter data
document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");
    let chart;
    let isInDrilldown = false;
    let currentDrilldownId = null;
    let isFiltering = false;

    function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
            console.log("Polling stopped");
        }
    }
    function startPolling() {
        if (!isFiltering) {
            fetchPage(currentPage);
            pollingTimer = setInterval(() => {
                fetchPage(currentPage);
            }, POLLING_INTERVAL);
            console.log("Polling started");
        }
    }
    // Xử lý sự kiện filter
    document.getElementById('filter').addEventListener('click', function () {
        event.preventDefault();
        this.dataset.filtering = 'true'; 
        fetchFilteredData(1); 
        isFiltering = true; 
        stopPolling();
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
                
                document.getElementById('loading').style.display = 'none';
                if (data.success) {
                    document.getElementById('count').textContent = data.message ||""
                    updateTable(data.data);
                    updatePagination(data.current_page, data.total_pages, data.group_start, data.group_end);
                    if (data.total_records == 0){
                        tableBody.innerHTML = `<tr><td colspan="12">No data found.</td></tr>`;
                        paginationDiv.innerHTML = '';
                    }
                    fetchPieChartData(time_update, time_end);
                } else {
                    tableBody.innerHTML = `<tr><td colspan="12">No data found.</td></tr>`;
                    paginationDiv.innerHTML = '';
                }
            })
            .catch(error => {
                console.error("Error fetching filtered data:", error);
                alert("Error fetching filtered data");
                tableBody.innerHTML = `<tr><td colspan="12">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
                paginationDiv.innerHTML = '';
                document.getElementById('loading').style.display = 'none';
            });
    }
    function updateTable(rows) {
        tableBody.innerHTML = rows.map(row => {
            const stateClass = row.state === 'PASS' ? 'state-pass' : 'state-fail';
            return `
                <tr>
                    <td>${row.stt}</td>
                    <td>${row.factory ?? 'N/A'}</td>
                    <td>${row.line ?? 'N/A'}</td>
                    <td>${row.name_machine ?? 'N/A'}</td>
                    <td>${row.model_name ?? 'N/A'}</td>
                    <td>${row.serial_number ?? 'N/A'}</td>
                    <td>${row.force_1 ?? 'N/A'}</td>
                    <td>${row.force_2 ?? 'N/A'}</td>
                    <td>${row.force_3 ?? 'N/A'}</td>
                    <td>${row.force_4 ?? 'N/A'}</td>
                    <td>${row.time_update ?? 'N/A'}</td>
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
    function bindPaginationEvents() {
        const links = paginationDiv.querySelectorAll(".page-link");
        links.forEach(link => {
            link.addEventListener("click", function (event) {
                event.preventDefault();
    
                const page = parseInt(this.getAttribute("data-page"), 10);
                if (!isNaN(page)) {
                    if (document.getElementById('filter').dataset.filtering === 'true') {
                        fetchFilteredData(page);
                    } else {
                        fetchPage(page);
                    }
                }
            });
        });
    }
    function fetchPieChartData(time_update, time_end) {
        const payload = {
            time_update: time_update ? time_update.replace('T', ' ') + ':00' : null,
            time_end: time_end ? time_end.replace('T', ' ') + ':00' : null
        };    
        fetch('/filterPieChart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            // console.log("Dữ liệu nhận được từ API:", data);
            if (data.success) {
                updatePieChart(data.pie_chart_date); 
            } else {
                return
            }
        })
        .catch(error => {
            console.error("Error fetching Pie Chart data:", error);
        });
    }
    //update pie chart
    function updatePieChart(pieData) {
        if (!pieData || !pieData.details) {
            console.error("Dữ liệu biểu đồ tròn không hợp lệ:", pieData);
            return; // Thoát khỏi hàm nếu không có dữ liệu hợp lệ
        }
        const passData = [];
        const failData = [];
        const drilldownPass = [];
        const drilldownFail = [];
        pieData.details.forEach(item => {
            if (item.state === "PASS") {
                passData.push({ name: item.model_name, y: item.percentage });
                drilldownPass.push([item.model_name, item.percentage]);
            } else {
                failData.push({ name: item.model_name, y: item.percentage });
                drilldownFail.push([item.model_name, item.percentage]);
            }
        });

        const chartData = [
            { name: "Pass", y: pieData.fpyPass, drilldown: "Pass", color: "#337cf2" },
            { name: "Fail", y: pieData.fpyFail, drilldown: "Fail", color: "#dc3545" }
        ];

        const drilldownSeries = [
            { name: "Pass", id: "Pass", data: drilldownPass },
            { name: "Fail", id: "Fail", data: drilldownFail }
        ];

        const chartOptions = {
            chart: {
                type: "pie",
                backgroundColor: null,
                plotBackgroundColor: null,
                events: {
                    drilldown: function(e) {
                        isInDrilldown = true;
                        currentDrilldownId = e.point.drilldown;
                    },
                    drillup: function() {
                        isInDrilldown = false;
                        currentDrilldownId = null;
                    }
                }
            },
            title: {
                text: "Rate Pass/Fail By 7 Day",
                align: "left",
                style: {
                    color: "#fff",
                    fontSize: "16px"
                }
            },
            accessibility: {
                announceNewData: {
                    enabled: true
                },
                point: {
                    valueSuffix: "%"
                },
                enabled: false
            },
            credits: false,
            plotOptions: {
                series: {
                    borderRadius: 5,
                    dataLabels: [{
                        enabled: true,
                        distance: 15,
                        format: "{point.name}"
                    }, {
                        enabled: true,
                        distance: "-30%",
                        filter: {
                            property: "percentage",
                            operator: ">",
                            value: 5
                        },
                        format: "{point.y:.1f}%",
                        style: {
                            fontSize: "1em",
                            color: "#fff",
                            textOutline: "none"
                        }
                    }]
                }
            },
            tooltip: {
                headerFormat: '<span style="font-size:12px">{series.name}</span><br>',
                pointFormat: '<span style="color:{point.color}">{point.name}</span>: ' +
                    "<b>{point.y:.2f}%</b> of total<br/>"
            },
            series: [{
                name: "Rate",
                colorByPoint: true,
                data: chartData
            }],
            drilldown: {
                series: drilldownSeries
            }
        };

        if (chart) {
            if (isInDrilldown && currentDrilldownId) {
                const currentDrilldownData = drilldownSeries.find(s => s.id === currentDrilldownId);
                if (currentDrilldownData) {
                    const drilldownSerie = chart.get(currentDrilldownId);
                    if (drilldownSerie) {
                        drilldownSerie.setData(currentDrilldownData.data);
                    }
                }
            } else {
                chart.series[0].setData(chartData);
                chart.drilldown.update({
                    series: drilldownSeries
                });
            }
        } else {
            chart = Highcharts.chart("container-pie", chartOptions);
        }
    }
    
});
//load dashboard
// document.addEventListener("DOMContentLoaded", function () {
//     const tableBody = document.getElementById("table-body");
//     const paginationDiv = document.getElementById("pagination");
//     const POLLING_INTERVAL = 60000;
//     let currentPage = 1;
//     let chart;
//     let isInDrilldown = false;
//     let currentDrilldownId = null;
//     // Hàm gọi API dashboard
//     function fetchPage(page = 1) {
//         document.getElementById('loading').style.display = 'block';
//         fetch(`/dashboard?page=${page}`, {
//             headers: {
//                 "X-Requested-With": "XMLHttpRequest"
//             }
//         })
//         .then(response => response.json())
//         .then(data => {
//             if (data.data) {
//                 document.getElementById('loading').style.display = 'none';
//                 updateTable(data.data);
//                 document.getElementById('count').textContent =""
//                 updatePagination(data.page, data.total_pages, data.group_start, data.group_end);
//                 updatePieChart(data.pie_chart_data);
//             } else {
//                 tableBody.innerHTML = `<tr><td colspan="12">No found data.</td></tr>`;
//                 paginationDiv.innerHTML = '';
//             }
//         })
//         .catch(error => {
//             console.error("Error fetching page data:", error);
//             tableBody.innerHTML = `<tr><td colspan="12">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
//             paginationDiv.innerHTML = '';
//         });
//     }
//     //update pie chart
//     function updatePieChart(pieData) {
//         const passData = [];
//         const failData = [];
//         const drilldownPass = [];
//         const drilldownFail = [];
//         pieData.details.forEach(item => {
//             if (item.state === "PASS") {
//                 passData.push({ name: item.model_name, y: item.percentage });
//                 drilldownPass.push([item.model_name, item.percentage]);
//             } else {
//                 failData.push({ name: item.model_name, y: item.percentage });
//                 drilldownFail.push([item.model_name, item.percentage]);
//             }
//         });

//         const chartData = [
//             { name: "Pass", y: pieData.fpyPass, drilldown: "Pass", color: "#337cf2" },
//             { name: "Fail", y: pieData.fpyFail, drilldown: "Fail", color: "#dc3545" }
//         ];

//         const drilldownSeries = [
//             { name: "Pass", id: "Pass", data: drilldownPass },
//             { name: "Fail", id: "Fail", data: drilldownFail }
//         ];

//         const chartOptions = {
//             chart: {
//                 type: "pie",
//                 backgroundColor: null,
//                 plotBackgroundColor: null,
//                 events: {
//                     drilldown: function(e) {
//                         isInDrilldown = true;
//                         currentDrilldownId = e.point.drilldown;
//                     },
//                     drillup: function() {
//                         isInDrilldown = false;
//                         currentDrilldownId = null;
//                     }
//                 }
//             },
//             title: {
//                 text: "Rate Pass/Fail By 7 Day",
//                 align: "left",
//                 style: {
//                     color: "#fff",
//                     fontSize: "16px"
//                 }
//             },
//             accessibility: {
//                 announceNewData: {
//                     enabled: true
//                 },
//                 point: {
//                     valueSuffix: "%"
//                 },
//                 enabled: false
//             },
//             credits: false,
//             plotOptions: {
//                 series: {
//                     borderRadius: 5,
//                     dataLabels: [{
//                         enabled: true,
//                         distance: 15,
//                         format: "{point.name}"
//                     }, {
//                         enabled: true,
//                         distance: "-30%",
//                         filter: {
//                             property: "percentage",
//                             operator: ">",
//                             value: 5
//                         },
//                         format: "{point.y:.1f}%",
//                         style: {
//                             fontSize: "1em",
//                             color: "#fff",
//                             textOutline: "none"
//                         }
//                     }]
//                 }
//             },
//             tooltip: {
//                 headerFormat: '<span style="font-size:12px">{series.name}</span><br>',
//                 pointFormat: '<span style="color:{point.color}">{point.name}</span>: ' +
//                     "<b>{point.y:.2f}%</b> of total<br/>"
//             },
//             series: [{
//                 name: "Rate",
//                 colorByPoint: true,
//                 data: chartData
//             }],
//             drilldown: {
//                 series: drilldownSeries
//             }
//         };

//         if (chart) {
//             if (isInDrilldown && currentDrilldownId) {
//                 const currentDrilldownData = drilldownSeries.find(s => s.id === currentDrilldownId);
//                 if (currentDrilldownData) {
//                     const drilldownSerie = chart.get(currentDrilldownId);
//                     if (drilldownSerie) {
//                         drilldownSerie.setData(currentDrilldownData.data);
//                     }
//                 }
//             } else {
//                 chart.series[0].setData(chartData);
//                 chart.drilldown.update({
//                     series: drilldownSeries
//                 });
//             }
//         } else {
//             chart = Highcharts.chart("container-pie", chartOptions);
//         }
//     }
//     function updateTable(rows) {
//         let fragment = document.createDocumentFragment();
//         rows.forEach(row => {
//             let tr = document.createElement("tr");
//             tr.innerHTML = `
//                 <td>${row.stt}</td>
//                 <td>${row.factory ?? 'N/A'}</td>
//                 <td>${row.line ?? 'N/A'}</td>
//                 <td>${row.serial_number ?? 'N/A'}</td>
//                 <td>${row.model_name ?? 'N/A'}</td>
//                 <td>${row.name_machine ?? 'N/A'}</td>
//                 <td>${row.force_1 ?? 'N/A'}</td>
//                 <td>${row.force_2 ?? 'N/A'}</td>
//                 <td>${row.force_3 ?? 'N/A'}</td>
//                 <td>${row.force_4 ?? 'N/A'}</td>
//                 <td>${row.time_update}</td>
//                 <td class="${row.state === 'PASS' ? 'state-pass' : 'state-fail'}">${row.state}</td>
//             `;
//             fragment.appendChild(tr);
//         });
//         tableBody.innerHTML = "";
//         tableBody.appendChild(fragment);
//     }
    
//     function updatePagination(currentPage, totalPages, groupStart, groupEnd) {
//         let paginationHTML = "";
//         if (currentPage > 1) {
//             paginationHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
//         }
//         for (let i = groupStart; i <= groupEnd; i++) {
//             paginationHTML += `
//                 <a href="#" class="page-link ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</a>
//             `;
//         }
//         if (currentPage < totalPages) {
//             paginationHTML += `<a href="#" class="page-link" data-page="${currentPage + 1}">&raquo;</a>`;
//         }
//         paginationDiv.innerHTML = paginationHTML;
//         bindPaginationEvents();
//     }
//     // Gắn sự kiện click phân trang
//     function bindPaginationEvents() {
//         const links = paginationDiv.querySelectorAll(".page-link");
//         links.forEach(link => {
//             link.addEventListener("click", function (event) {
//                 event.preventDefault();
//                 const page = parseInt(this.getAttribute("data-page"), 10);
//                 if (!isNaN(page)) {
//                     currentPage = page;
//                     fetchPage(page);
//                 }
//             });
//         });
//     }
//     function startPolling() {
//         fetchPage(currentPage); 
//         pollingTimer = setInterval(() => {
//             fetchPage(currentPage);
//         }, POLLING_INTERVAL);
//     }
//     startPolling();
// });

document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");
    const POLLING_INTERVAL = 60000;
    let currentPage = 1;
    let chart;
    let isInDrilldown = false;
    let currentDrilldownId = null;

    function fetchPage(page = 1) {
        document.getElementById('loading').style.display = 'block';
        fetch(`/api/dashboard/table?page=${page}`, {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('loading').style.display = 'none';
            if (data.data) {
                updateTable(data.data);
                document.getElementById('count').textContent = "";
                updatePagination(data.page, data.total_pages, data.group_start, data.group_end);
            } else {
                tableBody.innerHTML = `<tr><td colspan="12">No data found.</td></tr>`;
                paginationDiv.innerHTML = '';
            }
        })
        .catch(error => {
            console.error("Error fetching table data:", error);
            tableBody.innerHTML = `<tr><td colspan="12">Đã xảy ra lỗi khi tải dữ liệu.</td></tr>`;
            paginationDiv.innerHTML = '';
        });
    }

    function fetchChart() {
        fetch(`/api/dashboard/charts`, {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(response => response.json())
        .then(data => {
            if (data.pie_chart_data || data.column_chart_data) {
                updatePieChart(data.pie_chart_data);
                console.log("Dữ liệu từ backend: ", data.column_chart_data);
                drawColumnChart(data.column_chart_data);
            } else {
                console.error("No pie chart data available.");
            }
        })
        .catch(error => {
            console.error("Error fetching pie chart data:", error);            
        });
    }

    function updateTable(rows) {
        let fragment = document.createDocumentFragment();
        rows.forEach(row => {
            let tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.stt}</td>
                <td>${row.factory ?? 'N/A'}</td>
                <td>${row.line ?? 'N/A'}</td>
                <td>${row.serial_number ?? 'N/A'}</td>
                <td>${row.model_name ?? 'N/A'}</td>
                <td>${row.name_machine ?? 'N/A'}</td>
                <td>${row.force_1 ?? 'N/A'}</td>
                <td>${row.force_2 ?? 'N/A'}</td>
                <td>${row.force_3 ?? 'N/A'}</td>
                <td>${row.force_4 ?? 'N/A'}</td>
                <td>${row.time_update}</td>
                <td class="${row.state === 'PASS' ? 'state-pass' : 'state-fail'}">${row.state}</td>
            `;
            fragment.appendChild(tr);
        });
        tableBody.innerHTML = "";
        tableBody.appendChild(fragment);
    }
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
    function updatePieChart(pieData) {
                const passData = [];
                const failData = [];
                const drilldownPass = [];
                const drilldownFail = [];
                pieData.details.forEach(item => {
                    if (item.state === "PASS") {
                        passData.push({ name: item.model_name, y: item.percentage });
                        drilldownPass.push([item.model_name, item.percentage]);
                    } else {
                        failData.push({ name: item.model_name, y: item.percentage });
                        drilldownFail.push([item.model_name, item.percentage]);
                    }
                });
                const chartData = [
                    { name: "Pass", y: pieData.fpyPass, drilldown: "Pass", color: "#337cf2" },
                    { name: "Fail", y: pieData.fpyFail, drilldown: "Fail", color: "#dc3545" }
                ];
                const drilldownSeries = [
                    { name: "Pass", id: "Pass", data: drilldownPass },
                    { name: "Fail", id: "Fail", data: drilldownFail }
                ];
                const chartOptions = {
                    chart: {
                        type: "pie",
                        backgroundColor: null,
                        plotBackgroundColor: null,
                        events: {
                            drilldown: function(e) {
                                isInDrilldown = true;
                                currentDrilldownId = e.point.drilldown;
                            },
                            drillup: function() {
                                isInDrilldown = false;
                                currentDrilldownId = null;
                            }
                        }
                    },
                    title: {
                        text: "Rate Pass/Fail By 7 Day",
                        align: "left",
                        style: {
                            color: "#fff",
                            fontSize: "16px"
                        }
                    },
                    accessibility: {
                        announceNewData: {
                            enabled: true
                        },
                        point: {
                            valueSuffix: "%"
                        },
                        enabled: false
                    },
                    credits: false,
                    plotOptions: {
                        series: {
                            borderRadius: 5,
                            dataLabels: [{
                                enabled: true,
                                distance: 15,
                                format: "{point.name}"
                            }, {
                                enabled: true,
                                distance: "-30%",
                                filter: {
                                    property: "percentage",
                                    operator: ">",
                                    value: 5
                                },
                                format: "{point.y:.1f}%",
                                style: {
                                    fontSize: "1em",
                                    color: "#fff",
                                    textOutline: "none"
                                }
                            }]
                        }
                    },
                    tooltip: {
                        headerFormat: '<span style="font-size:12px">{series.name}</span><br>',
                        pointFormat: '<span style="color:{point.color}">{point.name}</span>: ' +
                            "<b>{point.y:.2f}%</b> of total<br/>"
                    },
                    series: [{
                        name: "Rate",
                        colorByPoint: true,
                        data: chartData
                    }],
                    drilldown: {
                        series: drilldownSeries
                    }
                };
        
                if (chart) {
                    if (isInDrilldown && currentDrilldownId) {
                        const currentDrilldownData = drilldownSeries.find(s => s.id === currentDrilldownId);
                        if (currentDrilldownData) {
                            const drilldownSerie = chart.get(currentDrilldownId);
                            if (drilldownSerie) {
                                drilldownSerie.setData(currentDrilldownData.data);
                            }
                        }
                    } else {
                        chart.series[0].setData(chartData);
                        chart.drilldown.update({
                            series: drilldownSeries
                        });
                    }
                } else {
                    chart = Highcharts.chart("container-pie", chartOptions);
                }
    }
    function processBackendData(columnData) {
        if (!columnData || columnData.length === 0) {
            console.error("No data available.");
            return { dates: [], seriesData: [], drilldownSeries: [] };
        }
    
        const validDays = columnData.filter(day =>
            day.machines.some(machine => machine.fail_count > 0)
        );
        const dates = validDays.map(item => item.date);
    
        let machineMap = {};
        let drilldownSeries = [];
    
        validDays.forEach(day => {
            const sortedMachines = day.machines
                .filter(machine => machine.fail_count > 0)
                .sort((a, b) => b.fail_count - a.fail_count);
    
            sortedMachines.forEach(machine => {
                if (!machineMap[machine.name]) {
                    machineMap[machine.name] = Array(dates.length).fill(null);
                }
            });
    
            sortedMachines.forEach(machine => {
                const dayIndex = dates.indexOf(day.date);
                machineMap[machine.name][dayIndex] = machine.fail_count;
    
                let fullHourlyData = Array.from({ length: 24 }, (_, hour) => [hour, 0]);
                if (machine.hourly_data && Array.isArray(machine.hourly_data)) {
                    machine.hourly_data.forEach(hourItem => {
                        fullHourlyData[parseInt(hourItem.hour)][1] = hourItem.fail_count;
                    });
                }
                
                drilldownSeries.push({
                    id: `${machine.name}-${day.date}`,
                    name: `Detail for ${machine.name} day ${day.date}`,
                    data: fullHourlyData,
                    xAxis: 1
                });
            });
        });
    
        let seriesData = Object.keys(machineMap).map(machineName => ({
            name: machineName,
            data: machineMap[machineName],
            drilldown: machineName
        })).sort((a, b) => {
            const totalA = a.data.reduce((sum, val) => sum + (val || 0), 0);
            const totalB = b.data.reduce((sum, val) => sum + (val || 0), 0);
            return totalB - totalA;
        });
    
        return { dates, seriesData, drilldownSeries };
    }
    
    function drawColumnChart(columnData) {
        const { dates, seriesData, drilldownSeries } = processBackendData(columnData);
    
        let chart = Highcharts.chart('container-toperr', {
            chart: { type: 'column', backgroundColor: null },
            title: {
                text: 'Top 3 Machine Fail Per Day',
                align: 'left',
                style: { color: '#fff', fontSize: '16px', fontWeight: 'bold' }
            },
            xAxis: [
                { 
                    categories: dates,
                    title: { text: 'Day', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } }
                },
                {
                    title: { text: 'Hour', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } },
                    categories: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                    visible: false
                }
            ],
            yAxis: {
                min: 0,
                title: { text: 'Fail Count', style: { color: '#fff', fontSize: '12px' } },
                labels: { style: { color: '#fff', fontSize: '12px' } }
            },
            tooltip: { shared: true, useHTML: true },
            plotOptions: {
                column: {
                    groupPadding: 0.1,
                    states: { hover: { brightness: 0.2 } },
                    stacking: 'normal'
                },
                series: { 
                    cursor: 'pointer',
                    dataLabels: { enabled: true },
                    point: {
                        events: {
                            click: function () {
                                const drilldownId = `${this.series.name}-${this.category}`;
                                const drilldownExists = chart.options.drilldown.series.some(d => d.id === drilldownId);    
    
                                if (drilldownExists) {
                                    chart.xAxis[0].update({ visible: false });
                                    chart.xAxis[1].update({ visible: true });
    
                                    chart.addSeriesAsDrilldown(this, {
                                        id: drilldownId,
                                        name: `Fail count for ${this.category}`,
                                        data: chart.options.drilldown.series.find(d => d.id === drilldownId).data,
                                        xAxis: 1
                                    });
    
                                    chart.applyDrilldown();
                                } else {                                    
                                    alert('No drilldown data found for', this.series.name);
                                }
                            }
                        }
                    }
                }
            },
            accessibility: { enabled: false },
            series: seriesData,
            drilldown: {
                series: drilldownSeries,
                events: {
                    drillup: function () {
                        chart.xAxis[0].update({ visible: true });
                        chart.xAxis[0].setCategories(dates, false); // 🔥 FIX lỗi mất trục X
                        chart.xAxis[1].update({ visible: false });
            
                        while (chart.series.length > seriesData.length) {
                            chart.series[chart.series.length - 1].remove(false);
                        }
            
                        chart.redraw();
                    }
                }
            }
            ,
            credits: { enabled: false },
            legend: {
                align: 'center',
                verticalAlign: 'bottom',
                itemStyle: { color: '#fff' },
                itemHoverStyle: { color: '#cccccc' }
            },
            exporting: {
                enabled: true,
                buttons: {
                    contextButton: {
                        menuItems: [
                            'viewFullscreen',
                            'separator',
                            'downloadPNG',
                            'downloadJPEG',
                            'downloadPDF',
                            'downloadSVG',
                            'separator',
                            'downloadCSV',
                            'downloadXLS',
                            'viewData'
                        ]
                    }
                }
            }
        });
    }
    
    
    
    
    function startPolling() {
        fetchPage(currentPage);
        fetchChart();

        pollingTimer = setInterval(() => {
            fetchPage(currentPage);
            fetchChart();
        }, POLLING_INTERVAL);
    }
    startPolling();
});

//Loading data 
async function fetchData(page) {
    document.getElementById("loading").style.display = "block";
  
    try {
      const response = await fetch(`/data?page=${page}`);
      const data = await response.json();
      console.log(data);
  
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      document.getElementById("loading").style.display = "none";
    }
  }
/*load info overview*/
document.addEventListener("DOMContentLoaded", function () {
    // DOM elements
    const totalRecords = document.getElementById("total-records");
    const outputPass = document.getElementById("pass-records");
    const failRecords = document.getElementById("fail-records");
    const fpyPercentage = document.getElementById("fpy-percentage");
    const POLLING_INTERVAL = 300000; 
    const lineCombobox = document.getElementById("line-combobox");
    const factoryCombobox = document.getElementById("factory-combobox");
    const stateCombobox = document.getElementById("state-combobox");
    const nameMachineCombobox = document.getElementById("nameMachine-combobox");
    const downloadButton = document.getElementById('download-excel');
    function fetchContentTop() {

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
    fetchContentTop();

    
    downloadButton.removeEventListener('click', handleDownload);
    downloadButton.addEventListener('click', handleDownload);
    async function handleDownload(event) {
        event.preventDefault();
        const formatDatetime = (datetime) => {
            return datetime ? datetime.replace('T', ' ') + ':00' : null;
        };
        const payload = {
            line: document.getElementById("line-combobox").value.trim() || null,
            factory: document.getElementById("factory-combobox").value.trim() || null,
            nameMachine: document.getElementById("nameMachine-combobox").value.trim() || null,
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

    // Fetch data from route /getLines 
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


















