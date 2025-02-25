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

    function fetchPieChart() {
        fetch(`/api/dashboard/charts`, {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(response => response.json())
        .then(data => {
            if (data.pie_chart_data || data.column_chart_data) {
                updatePieChart(data.pie_chart_data);
                console.log("Dữ liệu từ backend:", data.column_chart_data);
                // updateColumnChart(data.column_chart_data);
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
    function getRandomColor() {
        return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    }
    
    // function updateColumnChart(columnData) {
    //     if (!columnData || columnData.length === 0) {
    //         console.error("No column chart data available.");
    //         return;
    //     }
    
    //     const allMachines = columnData.map(item => ({
    //         date: item.date,
    //         machines: item.machines
    //       }));

    //     const dates = allMachines.map(item => item.date);
    //     console.log("Data for chart:", allMachines);
    
    //     // Vẽ biểu đồ Highcharts
    //     Highcharts.chart('container-toperr', {
    //         chart: {
    //             type: 'column',
    //             backgroundColor: null,
    //             plotBackgroundColor: null,
    //         },
    //         title: {
    //             text: 'Top 3 Machine Fail',
    //             align: 'left',
    //             style: { color: '#fff', fontSize: '16px', fontWeight: 'bold' }
    //         },
    //         xAxis: {
    //             categories: dates,
    //             title: { text: 'Day', style: { color: '#fff', fontSize: '12px' } },
    //             labels: { style: { color: '#fff', fontSize: '12px' } },
    //         },
    //         yAxis: {
    //             min: 0,
    //             title: { text: 'Count Fail', style: { color: '#fff', fontSize: '12px' } },
    //             labels: { style: { color: '#fff', fontSize: '12px' } }
    //         },
    //         tooltip: {
    //             shared: true,
    //             useHTML: true
    //         },
    //         plotOptions: {
    //             column: {
    //                 groupPadding: 0.1,
    //                 states: { hover: { brightness: 0.2 } }
    //             },
    //             series: { cursor: 'pointer' }
    //         },
    //         series: '',
    //         credits: { enabled: false },
    //         legend: {
    //             align: 'center',
    //             verticalAlign: 'bottom',
    //             itemStyle: { color: '#fff' },
    //             itemHoverStyle: { color: '#cccccc' }
    //         }
    //     });
    // }
    
    
    
    function startPolling() {
        fetchPage(currentPage);
        fetchPieChart();

        pollingTimer = setInterval(() => {
            fetchPage(currentPage);
            fetchPieChart();
        }, POLLING_INTERVAL);
    }
    startPolling();
});

//Loading data 
async function fetchData(page) {
    // Hiển thị GIF khi bắt đầu tải dữ liệu
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

    const downloadButton = document.getElementById('download-excel');
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

    const lineCombobox = document.getElementById("line-combobox");
    const factoryCombobox = document.getElementById("factory-combobox");
    const stateCombobox = document.getElementById("state-combobox");
    const nameMachineCombobox = document.getElementById("nameMachine-combobox");
    
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
//download excel
// document.addEventListener("DOMContentLoaded", function () {
//     const downloadButton = document.getElementById('download-excel');
//     downloadButton.removeEventListener('click', handleDownload);
//     downloadButton.addEventListener('click', handleDownload);
//     async function handleDownload(event) {
//         event.preventDefault();
//         const formatDatetime = (datetime) => {
//             return datetime ? datetime.replace('T', ' ') + ':00' : null;
//         };
//         const payload = {
//             line: document.getElementById("line-combobox").value.trim() || null,
//             factory: document.getElementById("factory-combobox").value.trim() || null,
//             nameMachine: document.getElementById("nameMachine-combobox").value.trim() || null,
//             time_update: formatDatetime(document.getElementById("time_update").value),
//             time_end: formatDatetime(document.getElementById("time_end").value),
//             state: document.getElementById("state-combobox").value || null
//         };
//         try {
//             const response = await fetch('/downloadExcel', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'X-Requested-With': 'XMLHttpRequest'
//                 },
//                 body: JSON.stringify(payload)
//             });
//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }
//             const blob = await response.blob();
//             const url = window.URL.createObjectURL(blob);
//             const a = document.createElement('a');
//             a.style.display = 'none';
//             a.href = url;
//             a.download = `filtered_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
//             document.body.appendChild(a);
//             a.click();
//             window.URL.revokeObjectURL(url);
//         } catch (error) {
//             console.error("Error downloading Excel:", error);
//             alert("Failed to download the Excel file. Please try again.");
//         }
//     }
// }); 
//get lines, states, factories, namemachines
// document.addEventListener("DOMContentLoaded", function () {
//     const lineCombobox = document.getElementById("line-combobox");
//     const factoryCombobox = document.getElementById("factory-combobox");
//     const stateCombobox = document.getElementById("state-combobox");
//     const nameMachineCombobox = document.getElementById("nameMachine-combobox");
    
//     // Fetch data from route /getLines 
//     fetch("/getLines")
//         .then(response => {
//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }
//             return response.json();
//         })
//         .then(data => {
//             lineCombobox.innerHTML = '<option value="">All</option>';
//             data.lines.forEach(line => {
//                 const option = document.createElement("option");
//                 option.value = line;
//                 option.textContent = line;
//                 lineCombobox.appendChild(option);
//             });
//             factoryCombobox.innerHTML = '<option value="">All</option>';
//             data.factories.forEach(factory => {
//                 const option = document.createElement("option");
//                 option.value = factory;
//                 option.textContent = factory;
//                 factoryCombobox.appendChild(option);
//             });
//             stateCombobox.innerHTML = '<option value="">All</option>';
//             data.states.forEach(state => {
//                 const option = document.createElement("option");
//                 option.value = state;
//                 option.textContent = state;
//                 stateCombobox.appendChild(option);
//             });
//             nameMachineCombobox.innerHTML = '<option value="">All</option>';
//             data.nameMachines.forEach(nameMachine => {
//                 const option = document.createElement("option");
//                 option.value = nameMachine;
//                 option.textContent = nameMachine;
//                 nameMachineCombobox.appendChild(option);
//             });
//         })
//         .catch(error => {
//             console.error("Error fetching lines and states:", error);
//         });
// });
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


















