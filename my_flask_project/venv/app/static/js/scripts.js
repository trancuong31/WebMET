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
    let isFirstLoad = true;

    function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
            console.log("Polling stopped");
        }
    }
    /* function startPolling() {
    //     if (!isFiltering) {
    //         fetchPage(currentPage);
    //         pollingTimer = setInterval(() => {
    //             fetchPage(currentPage);
    //         }, POLLING_INTERVAL);
    //         console.log("Polling started");
    //     }
    // } */

    // Xử lý sự kiện filter
    document.getElementById('filter').addEventListener('click', function (event) {
        event.preventDefault();
        this.dataset.filtering = 'true'; 
        isFiltering = true;
        stopPolling();    
        fetchFilteredData(1, false);
    });    
    function fetchFilteredData(page = 1, isPagination = false) {
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
                        tableBody.innerHTML = `<tr><td class="no-data" colspan="12">No data found.</td></tr>`;
                        paginationDiv.innerHTML = '';
                    }
                    if (!isPagination) {
                        fetchPieChartData(time_update, time_end);
                        fetchColumnChartData(time_update, time_end);
                        fetchColumn2ChartData(time_update, time_end);
                    }
                } else {
                    tableBody.innerHTML = `<tr><td colspan="12">No data found.</td></tr>`;
                    paginationDiv.innerHTML = '';
                }
            })

            .catch(error => {
                console.error("Error fetching filtered data:", error);
                alert("Error fetching filtered data");
                tableBody.innerHTML = `<tr><td colspan="12">An error occurred while loading data.</td></tr>`;
                paginationDiv.innerHTML = '';
                document.getElementById('loading').style.display = 'none';
            });
            isFirstLoad = false;
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
                    <td class="${stateClass}">${row.state ?? 'N/A'}</td>
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
                        fetchFilteredData(page, true);
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
    function fetchColumnChartData(time_update, time_end) {
        const payload = {
            time_update: time_update ? time_update.replace('T', ' ') + ':00' : null,
            time_end: time_end ? time_end.replace('T', ' ') + ':00' : null
        };
        fetch('/filterColumnChart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })    
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                drawColumnChart(data.column_chart_date); 
            } else {
                return
            }
        })
        .catch(error => {
            console.error("Error fetching Pie Chart data:", error);
        });
    }
    function fetchColumn2ChartData(time_update, time_end) {
        const payload = {
            time_update: time_update ? time_update.replace('T', ' ') + ':00' : null,
            time_end: time_end ? time_end.replace('T', ' ') + ':00' : null
        };
        fetch('/filterColumn2Chart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })    
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                drawColumn2Chart(data.column2_chart_date); 
            } else {
                return
            }
        })
        .catch(error => {
            console.error("Error fetching Screw Trend Chart data:", error);
        });
    }
    //update pie chart
    function updatePieChart(pieData) {
        if (!pieData || !pieData.details) {
            console.error("Dữ liệu biểu đồ tròn không hợp lệ:", pieData);
            return; 
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
    function processDataColumnChart(columnData) {
        if (!columnData || columnData.length === 0) {
            console.error("No data available.");
            return { dates: [], seriesData: [], drilldownSeries: [] };
        }
        const dates = columnData
            .map(item => item.date)
            .sort((a, b) => new Date(a) - new Date(b));
    
        let machineMap = {};
        let drilldownSeries = [];
    
        columnData.forEach(day => {
            const dayIndex = dates.indexOf(day.date);
            if (!day.machines || day.machines.length === 0) {
                return;
            }
            day.machines.forEach(machine => {
                if (!machineMap[machine.name]) {
                    machineMap[machine.name] = Array(dates.length).fill(null);
                }
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
            drilldown: machineName,
            yAxis: 0 
        }));
        
        console.log(dates)
        console.log(seriesData)
        console.log(drilldownSeries)
        return { dates, seriesData, drilldownSeries };
    }     
    function drawColumnChart(columnData) {
        const { dates, seriesData, drilldownSeries } = processDataColumnChart(columnData);
    
        let chart = Highcharts.chart('container-toperr', {
            chart: { type: 'column', 
                backgroundColor: null, 
                zooming: {
                type: 'x'
              },
              animation: {
                duration: 600, 
                easing: 'easeOutExpo'
            } },
            
            title: {
                text: 'Top 5 Machine Fail Per Day',
                align: 'left',
                style: { color: '#fff', fontSize: '16px', fontWeight: 'bold' }
            },
            xAxis: [
                {
                    categories: dates,
                    title: { text: 'Day', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } },
                    visible: true
                },
                {
                    title: { text: 'Hour', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } },
                    categories: Array.from({ length: 24 }, (_, i) => `${i}:00 - ${i+1}:00`),
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
                                        name: `Fail Count`,
                                        data: chart.options.drilldown.series.find(d => d.id === drilldownId).data,
                                        xAxis: 1
                                    });
                                    chart.applyDrilldown();
                                }
                            }
                        }
                    }
                }
            },
            accessibility: { enabled: false },
            series: seriesData,
            drilldown: {
                series: drilldownSeries
            },
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
        Highcharts.addEvent(chart, 'drillup', function () {
            chart.update({
                xAxis: [
                    { visible: true },  
                    { visible: false }
                ]
            });
        });
    }
    function drawColumn2Chart(data) {
        try {
            const categories = data.map(item => item.date);
            const passData = data.map(item => isNaN(item.count_pass) ? 0 : item.count_pass);
            const failData = data.map(item => isNaN(item.count_fail) ? 0 : item.count_fail);
            const fpyData = data.map(item => isNaN(item.fpy) ? 0 : item.fpy);
            if (passData.every(val => val === 0) && failData.every(val => val === 0) && fpyData.every(val => val === 0)) {
                console.warn("No valid data to display in the chart.");
                return;
            }    
            Highcharts.chart('container3', {
                chart: {
                    zooming: {
                      type: 'x'
                    },
                    backgroundColor: null,
                    plotBackgroundColor:null
                  },
                  title: {
                    text: 'Screw Force Trend',
                    align: 'left',
                     style: {
                        color: '#fff', 
                        fontSize: '16px', 
                        fontWeight: 'bold'
                      }
                  },
                  credits: {
                    enabled: null
                  },
                accessibility:{
                  enabled: false
                },
                xAxis: {
                    categories: categories,
                    crosshair: true,
                      labels: {
                        style: {
                          color: '#fff', 
                          fontSize: '12px'
                        }
                      },
                      title: { text: 'Day', style: { color: '#fff', fontSize: '12px' } }
                },
                yAxis: [{
                    labels: {
                        format: '{value}°%',
                        style: {
                          color: '#fff'
                        }
                      },
                      title: {
                        text: 'FPY',
                        style: {
                          color: '#fff'
                        }
                      }
                    }, { 
                      title: {
                        text: 'Count',
                        style: {
                          color: '#fff'
                        }
                      },
                      labels: {
                        format: '{value}',
                        style: {
                          color: '#fff'
                        }
                      },
                      opposite: true
                    }],
                tooltip: {
                    shared: true
                },
                legend: {
                    align: 'center',
                    verticalAlign: 'bottom',
                    itemStyle:{
                      color: '#fff'
                    },
                    itemHoverStyle: {
                    color: '#cccccc'
                  }
                },
                series: [{
                    name: 'Pass',
                    type: 'column',
                    yAxis: 1,
                    color: {
                        linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                        stops: [
                            [0, '#007bff'],
                            [1, '#003366']
                        ]
                    },
                    data: passData,
                    tooltip: {
                      valueSuffix: ''
                    }
                  }, {
                    name: 'Fail',
                    type: 'column',  
                    yAxis: 1,
                    color: {
                        linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                        stops: [
                            [0, '#f88e8e'],
                            [1, '#f84646']
                        ]
                    },
                    data: failData,
                    tooltip: {
                      valueSuffix: ''
                    }
                  }, {
                    name: 'FPY',
                    type: 'spline', 
                    data: fpyData,
                    tooltip: {
                      valueSuffix: ' %'
                    }
                  }]
            });
        } catch (error) {
            console.error('Error generating column chart:', error);
        }
    }
});
//load dashboard
document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");
    const POLLING_INTERVAL = 60000;
    let currentPage = 1;
    console.log("Dashboard loaded and polling data :", POLLING_INTERVAL +"ms");
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
            tableBody.innerHTML = `<tr><td colspan="12">An error orccued while fetching data.</td></tr>`;
            paginationDiv.innerHTML = '';
        });
    }
    function fetchChart() {
        fetch(`/api/dashboard/charts`, {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(response => response.json())
        .then(data => {
            // console.log("Charts data:", data);
            if (data.pie_chart_data || data.column_chart_data || data.column2_chart_data) {
                updatePieChart(data.pie_chart_data);
                drawColumnChart(data.column_chart_data);
                drawColumn2Chart(data.column2_chart_data);
            } else {
                console.error("Charts data not available.");
            }
        })
        .catch(error => {
            console.error("Error fetching pie chart data:", error);
            alert("Error fetch data charts:", error)            
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
                <td>${row.time_update ?? 'N/A'}</td>
                <td class="${row.state === 'PASS' ? 'state-pass' : 'state-fail'}">${row.state ?? 'N/A'}</td>
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
                        cursor: 'pointer',
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
    function processDataColumnChart(columnData) {
        if (!columnData || columnData.length === 0) {
            console.error("No data available.");
            return { dates: [], seriesData: [], drilldownSeries: [] };
        }
        const dates = columnData
            .map(item => item.date)
            .sort((a, b) => new Date(a) - new Date(b));
        let machineMap = {};
        let drilldownSeries = [];
        columnData.forEach(day => {
            const dayIndex = dates.indexOf(day.date);
            if (!day.machines || day.machines.length === 0) {
                return;
            }
            day.machines.forEach(machine => {
                if (!machineMap[machine.name]) {
                    machineMap[machine.name] = Array(dates.length).fill(null);
                }
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
            drilldown: machineName,
            yAxis: 0
        }));
        return { dates, seriesData, drilldownSeries };
    }
    function drawColumnChart(columnData) {
        const { dates, seriesData, drilldownSeries } = processDataColumnChart(columnData);
    
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
                    labels: { style: { color: '#fff', fontSize: '12px' } },
                    visible: true
                },
                {
                    title: { text: 'Hour', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } },
                    categories: Array.from({ length: 24 }, (_, i) => `${i}:00 - ${i+1}:00`),
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
                                        name: `Fail Count`,
                                        data: chart.options.drilldown.series.find(d => d.id === drilldownId).data,
                                        xAxis: 1
                                    });
                                    chart.applyDrilldown();
                                }
                            }
                        }
                    }
                }
            },
            accessibility: { enabled: false },
            series: seriesData,
            drilldown: {
                series: drilldownSeries
            },
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
        Highcharts.addEvent(chart, 'drillup', function () {
            chart.update({
                xAxis: [
                    { visible: true },  
                    { visible: false }
                ]
            });
        });
    }
    function drawColumn2Chart(data) {
        try {
            const categories = data.map(item => item.date);
            const passData = data.map(item => isNaN(item.count_pass) ? 0 : item.count_pass);
            const failData = data.map(item => isNaN(item.count_fail) ? 0 : item.count_fail);
            const fpyData = data.map(item => isNaN(item.fpy) ? 0 : item.fpy);
            if (passData.every(val => val === 0) && failData.every(val => val === 0) && fpyData.every(val => val === 0)) {
                console.warn("No valid data to display in the chart.");
                return;
            }    
            Highcharts.chart('container3', {
                chart: {
                    zooming: {
                      type: 'x'
                    },
                    backgroundColor: null,
                    plotBackgroundColor:null
                  },
                  title: {
                    text: 'Screw Force Trend',
                    align: 'left',
                     style: {
                        color: '#fff', 
                        fontSize: '16px', 
                        fontWeight: 'bold'
                      }
                  },
                  credits: {
                    enabled: null
                  },
                accessibility:{
                  enabled: false
                },
                xAxis: {
                    categories: categories,
                    crosshair: true,
                      labels: {
                        style: {
                          color: '#fff', 
                          fontSize: '12px'
                        }
                      },
                      title: { text: 'Day', style: { color: '#fff', fontSize: '12px' } }
                },
                yAxis: [{
                    labels: {
                        format: '{value}°%',
                        style: {
                          color: '#fff'
                        }
                      },
                      title: {
                        text: 'FPY',
                        style: {
                          color: '#fff'
                        }
                      }
                    }, { 
                      title: {
                        text: 'Count',
                        style: {
                          color: '#fff'
                        }
                      },
                      labels: {
                        format: '{value}',
                        style: {
                          color: '#fff'
                        }
                      },
                      opposite: true
                    }],
                tooltip: {
                    shared: true
                },
                legend: {
                    align: 'center',
                    verticalAlign: 'bottom',
                    itemStyle:{
                      color: '#fff'
                    },
                    itemHoverStyle: {
                    color: '#cccccc'
                  }
                },
                series: [{
                    name: 'Pass',
                    type: 'column',
                    yAxis: 1,
                    color: {
                        linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                        stops: [
                            [0, '#007bff'],
                            [1, '#003366']
                        ]
                    },
                    data: passData,
                    tooltip: {
                      valueSuffix: ''
                    }
                  }, {
                    name: 'Fail',
                    type: 'column',  
                    yAxis: 1,
                    color: {
                        linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                        stops: [
                            [0, '#f88e8e'],
                            [1, '#f84646']
                        ]
                    },
                    data: failData,
                    tooltip: {
                      valueSuffix: ''
                    }
                  }, {
                    name: 'FPY',
                    type: 'spline', 
                    data: fpyData,
                    tooltip: {
                      valueSuffix: ' %'
                    }
                  }]
            });
        } catch (error) {
            console.error('Error generating column chart:', error);
        }
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
//load info overview
document.addEventListener("DOMContentLoaded", function () {
    const totalRecords = document.getElementById("total-records");
    const outputPass = document.getElementById("pass-records");
    const failRecords = document.getElementById("fail-records");
    const fpyPercentage = document.getElementById("fpy-percentage");
    const POLLING_INTERVAL = 300000; //(ms)
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
                setTimeout(fetchContentTop, POLLING_INTERVAL); 
            });
    }
    fetchContentTop();
    
    // downloadButton.removeEventListener('click', handleDownload);
    // downloadButton.addEventListener('click', handleDownload);
    //Download Excel
    // async function handleDownload(event) {
    //     event.preventDefault();
    //     const isConfirmed = window.confirm("Large data may slow down the download. Check the filter before downloading. Continue?");
    //     if (!isConfirmed) {
    //         return;
    //     }
    //         const formatDatetime = (datetime) => {
    //             return datetime ? datetime.replace('T', ' ') + ':00' : null;
    //         };
    //     const payload = {
    //         line: document.getElementById("line-combobox").value.trim() || null,
    //         factory: document.getElementById("factory-combobox").value.trim() || null,
    //         nameMachine: document.getElementById("nameMachine-combobox").value.trim() || null,
    //         time_update: formatDatetime(document.getElementById("time_update").value),
    //         time_end: formatDatetime(document.getElementById("time_end").value),
    //         state: document.getElementById("state-combobox").value || null
    //     };
    //     document.getElementById('loading').style.display = 'block';
    //     try {
    //         const response = await fetch('/downloadExcel', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'X-Requested-With': 'XMLHttpRequest'
    //             },
    //             body: JSON.stringify(payload)
    //         });
    //         if (!response.ok) {
    //             throw new Error(`HTTP error! status: ${response.status}`);
    //         }
    //         const blob = await response.blob();
    //         const url = window.URL.createObjectURL(blob);
    //         const a = document.createElement('a');
    //         a.style.display = 'none';
    //         a.href = url;
    //         a.download = `filtered_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
    //         document.body.appendChild(a);
    //         a.click();
    //         window.URL.revokeObjectURL(url);
    //     } catch (error) {
    //         console.error("Error downloading Excel:", error);
    //         alert("Failed to download the Excel file. Please try again.");
    //     } finally{
    //         document.getElementById('loading').style.display = 'none';
    //     }
    // }
    // Fetch data comboboxs
    fetch("/getDataComboboxs")
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
document.addEventListener("DOMContentLoaded", function () {
    const fullscreenIcon = document.getElementById("fullscreenic");
    const toggleFullscreen = document.getElementById("toggle_fullscreen");

    document.addEventListener("fullscreenchange", function () {
        if (document.fullscreenElement) {
            fullscreenIcon.title = "Exit Fullscreen";
            fullscreenIcon.src = "/static/images/disfullscreen.png";
        } else {
            fullscreenIcon.title = "Fullscreen";
            fullscreenIcon.src = "/static/images/fullscreen1.png";
        }
    });

    toggleFullscreen.addEventListener("click", function (e) {
        e.preventDefault();
        const container = document.documentElement;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    });
});

document.addEventListener("DOMContentLoaded", function() {
    const downloadButton = document.getElementById('download-excel');
    const downloadModal = document.getElementById('downloadModal');
    const confirmDownload = document.getElementById('confirmDownload');
    const cancelDownload = document.getElementById('cancelDownload');

    downloadButton.addEventListener('click', function(event) {
        event.preventDefault();
        downloadModal.style.display = 'flex';
    });

    cancelDownload.addEventListener('click', function() {
        downloadModal.style.display = 'none';
    });

    confirmDownload.addEventListener('click', async function() {
        downloadModal.style.display = 'none';

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

        document.getElementById('loading').style.display = 'block';

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
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    });
});



















