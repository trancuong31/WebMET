let machineTypeSelect;
let getCurrentMachineType;
let pollingTimer = null; 
function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
            console.log("Polling stopped");
        }
    }
//filter data
function initializeFilter() {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");
    let chart;
    let isInDrilldown = false;
    let currentDrilldownId = null;
    let column2Chart = null;
    let columnChart = null;
    let forceChart = null;
    let forceLimits = {};    
    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    // Xử lý sự kiện filter
    document.getElementById('filter').addEventListener('click', 
        debounce(async function (event) {
        event.preventDefault();
        const button = this;
        button.disabled = true;
        initForceLimitsAndLoad();
        this.dataset.filtering = 'true';
        isFiltering = true;
        stopPolling();
        await fetchFilteredData(1, false);
        setTimeout(() => {
            button.disabled = false;
        }, 500);
    }, 600));
    
    async function fetchFilteredData(page = 1, isPagination = false) {
        const line = document.getElementById('line-combobox').value.trim();
        const factory = document.getElementById('factory-combobox').value.trim();
        const model = document.getElementById('modelNamecombobox').value.trim();
        const time_update = document.getElementById('time_update').value.trim();
        const time_end = document.getElementById('time_end').value.trim();
        const state = document.getElementById('state-combobox').value.trim();
        const nameMachine = document.getElementById('nameMachine-combobox').value.trim();
    
        const formatDatetime = (datetime) => datetime ? datetime.replace('T', ' ') + ':00' : null;
    
        const params = new URLSearchParams();
        if (line) params.append('line', line);
        if (factory) params.append('factory', factory);
        if (model) params.append('model', model);
        if (nameMachine) params.append('nameMachine', nameMachine);
        if (time_update) params.append('time_update', formatDatetime(time_update));
        if (time_end) params.append('time_end', formatDatetime(time_end));
        if (state) params.append('state', state);
        
        params.append('page', page);
        params.append('per_page', 10);
        params.append('typeMachine', getCurrentMachineType());

    
        const url = `/api/filter?${params.toString()}`;
    
        const loadingEl = document.getElementById('loading');
        loadingEl.style.display = 'block';
    
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
    
            const data = await response.json();
            loadingEl.style.display = 'none';
    
            if (data.success) {
                document.getElementById('count').textContent = data.message || "";
                updateTable(data.data);
                updatePagination(data.current_page, data.total_pages, data.group_start, data.group_end);
                if (data.total_records == 0) {
                    tableBody.innerHTML = `<tr><td class="no-data" colspan="12">No data found.</td></tr>`;
                    paginationDiv.innerHTML = '';
                }
                if (!isPagination) {
                    fetchAllChartData(time_update, time_end, nameMachine, line);
                }
            } else {
                tableBody.innerHTML = `<tr><td colspan="12">No data found.</td></tr>`;
                paginationDiv.innerHTML = '';
            }
        } catch (error) {
            console.error("Error fetching filtered data:", error);
            alert("Error fetching filtered data");
            tableBody.innerHTML = `<tr><td colspan="12">An error occurred while loading data.</td></tr>`;
            paginationDiv.innerHTML = '';
            loadingEl.style.display = 'none';
        }
    }//setup column chart top machine fail per day
function drawColumnChart(columnData) {
    const { dates, seriesData, drilldownSeries } = processDataColumnChart(columnData);
    if (columnChart) {
        // Lấy danh sách tên series hiện tại và mới
        const currentSeriesNames = columnChart.series.map(s => s.name);
        const newSeriesNames = seriesData.map(s => s.name);

        // Xác định series cần xóa, thêm, hoặc cập nhật
        const seriesToRemove = currentSeriesNames.filter(name => !newSeriesNames.includes(name));
        const seriesToAdd = seriesData.filter(s => !currentSeriesNames.includes(s.name));
        const seriesToUpdate = seriesData.filter(s => currentSeriesNames.includes(s.name));

        // Xóa series không còn trong dữ liệu mới
        seriesToRemove.forEach(name => {
            const series = columnChart.series.find(s => s.name === name);
            if (series) series.remove(false);
        });

        // Thêm series mới
        seriesToAdd.forEach(newSeries => {
            columnChart.addSeries(newSeries, false);
        });

        // Cập nhật dữ liệu cho series hiện có
        seriesToUpdate.forEach(newSeries => {
            const series = columnChart.series.find(s => s.name === newSeries.name);
            if (series) series.setData(newSeries.data, false);
        });

        // Cập nhật trục x và drilldown
        columnChart.xAxis[0].setCategories(dates, false);
        columnChart.update({
            drilldown: { series: drilldownSeries }
        }, false);

        // Vẽ lại biểu đồ
        columnChart.redraw();
        return;
    }

    columnChart = Highcharts.chart('container-toperr', {
        chart: {
            type: 'column',
            backgroundColor: null,
            zooming: { type: 'x' },
            animation: { duration: 600, easing: 'easeOutExpo' }
        },
        subtitle: {
            text: 'Click on the columns to view details',
            align: 'left',
            verticalAlign: 'top',
            style: {
              fontSize: '12px',
              color: '#606060'
            }
          },
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
                categories: Array.from({ length: 24 }, (_, i) => `${i}:00 - ${i + 1}:00`),
                title: { text: 'Hour', style: { color: '#fff', fontSize: '12px' } },
                labels: { style: { color: '#fff', fontSize: '12px' } },
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
                            const drilldownExists = columnChart.options.drilldown.series.some(d => d.id === drilldownId);

                            if (drilldownExists) {
                                columnChart.xAxis[0].update({ visible: false });
                                columnChart.xAxis[1].update({ visible: true });

                                const drillSeries = columnChart.options.drilldown.series.find(d => d.id === drilldownId);
                                const seriesData = drillSeries.data.map(item => ({
                                    name: item.name,
                                    y: item.y,
                                    custom: { details: item.custom.details }
                                }));

                                columnChart.addSeriesAsDrilldown(this, {
                                    id: drilldownId,
                                    name: `Fail Count`,
                                    data: seriesData,
                                    xAxis: 1
                                });
                                columnChart.applyDrilldown();
                            }
                            else if (this.options.custom && this.options.custom.details) {
                                console.log("Details:", this.options.custom.details);
                                showDetailsModal(this.options.custom.details);
                            }

                        }
                    }
                }
            }
        },
        accessibility: { enabled: false },
        series: seriesData,
        drilldown: { series: drilldownSeries },
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

    Highcharts.addEvent(columnChart, 'drillup', function () {
        columnChart.update({
            xAxis: [{ visible: true }, { visible: false }]
        });
    });
}
    function initForceLimitsAndLoad() {
        fetch(`/api/dashboard/getDefaultForce?type_machine=${getCurrentMachineType()}`)
            .then(res => res.json())
            .then(data => {
                forceLimits = data; 
            })
            .catch(err => {
                console.error("Lỗi khi lấy ngưỡng lực:", err);
            });
    }
    function checkForceValue(line, machine, value) {
        const key = `${line},${machine}`;
        const limits = forceLimits[key];
        if (value === null || value === undefined || value === "N/A") {
        return "force-na";
    }
        if (!limits) return "high-force"; 
    
        const { min, max } = limits;
        return (value >= min && value <= max) ? "low-force" : "high-force";
    }
    function updateTable(rows) {
        let fragment = document.createDocumentFragment();
        rows.forEach(row => {
            let tr = document.createElement("tr");
            tr.innerHTML = `
                <td class ="stt">${row.stt}</td>
                <td>
                ${[row.factory, row.line, row.name_machine].filter(Boolean).join('_') || 'N/A'}
                </td>
                <td>${row.model_name ?? 'N/A'}</td>
                <td>${row.serial_number ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_1)}">${row.force_1 ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_2)}">${row.force_2 ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_3)}">${row.force_3 ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_4)}">${row.force_4 ?? 'N/A'}</td>
                <td class = "time">${row.time_update ?? 'N/A'}</td>
                <td class="${row.result === 'PASS' ? 'state-pass' : 'state-fail'}">${row.result ?? 'N/A'}</td>
            `;
            fragment.appendChild(tr);
        });
        tableBody.innerHTML = "";
        tableBody.appendChild(fragment);
    }
    //pagination table
    function updatePagination(currentPage, totalPages) {
        let paginationHTML = "";
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);

        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        if (currentPage > 1) {
            paginationHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
        }
        for (let i = startPage; i <= endPage; i++) {
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
                    if (document.getElementById('filter').dataset.filtering === 'true') {
                        fetchFilteredData(page, true);
                    } else {
                        fetchPage(page);
                    }
                }
            });
        });
    }
    function fetchAllChartData(time_update, time_end, machine_name, line) {
        const formattedTimeUpdate = time_update ? time_update.replace('T', ' ') + ':00' : null;
        const formattedTimeEnd = time_end ? time_end.replace('T', ' ') + ':00' : null;
        const totalDay = time_end === time_update ? 7 : Math.floor((new Date(time_end) - new Date(time_update)) / (1000 * 60 * 60 * 24));
        
        const params = new URLSearchParams();
        params.append("type_machine", getCurrentMachineType());
        if (formattedTimeUpdate) params.append("time_update", formattedTimeUpdate);
        if (formattedTimeEnd) params.append("time_end", formattedTimeEnd);
        if (machine_name) params.append("nameMachine", machine_name);
        if (line) params.append("line", line);
        
        const url = `/api/dashboard/filterCharts?${params.toString()}`;
        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.pie_chart_data) updatePieChart(data.pie_chart_data, totalDay, machine_name, line);
                if (data.column_chart_data) drawColumnChart(data.column_chart_data);
                if (data.column2_chart_data) drawColumn2Chart(data.column2_chart_data, 98, machine_name, line);
                if (data.force_chart_data) drawForceChart(data.force_chart_data);
            } else {
                console.error("Lỗi dữ liệu biểu đồ:", data.error);
            }
        })
        .catch(error => {
            console.error("Lỗi gọi API biểu đồ:", error);
        });
    }
    function updatePieChart(pieData, totalDay, machine_name, line) {
        if (!pieData || !pieData.details) {
            console.error("Dữ liệu biểu đồ tròn không hợp lệ:", pieData);
            return; 
        }
        const titleText = `Pass/Fail By ${totalDay} Day Of ${machine_name || 'Machine NaN'} on ${line || 'Line NaN'}`;
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
            { name: "Pass", y: pieData.fpyPass, drilldown: "Pass", color: {
                linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                stops: [[0, '#007bff'], [1, '#003366']]
            } },
            { name: "Fail", y: pieData.fpyFail, drilldown: "Fail", color: {
                linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                stops: [[0, '#f88e8e'], [1, '#f84646']]
            } }
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
            subtitle: {
                text: 'Click on the slices to view details',
                align: 'left',
                verticalAlign: 'top',
                style: {
                  fontSize: '12px',
                  color: '#606060'
                }
              },
            title: {
                text: titleText,
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
            chart.update({
                title: {
                    text: titleText
                },
                series: [{
                    data: chartData
                }],
                drilldown: {
                    series: drilldownSeries
                }
            });
            if (isInDrilldown && currentDrilldownId) {
                const currentDrilldownData = drilldownSeries.find(s => s.id === currentDrilldownId);
                if (currentDrilldownData) {
                    const drilldownSerie = chart.get(currentDrilldownId);
                    if (drilldownSerie) {
                        drilldownSerie.setData(currentDrilldownData.data);
                    }
                }
            } 
            else {
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

        const dates = [...new Set(columnData.map(item => item.date))].sort((a, b) => new Date(a) - new Date(b));

        let machineMap = {};
        let drilldownSeries = [];

        columnData.forEach(day => {
            const dayIndex = dates.indexOf(day.date);
            if (!day.machines || day.machines.length === 0) return;

            day.machines.sort((a, b) => b.fail_count - a.fail_count);

            day.machines.forEach(machine => {
                if (!machineMap[machine.name]) {
                    machineMap[machine.name] = Array(dates.length).fill(null);
                }
                machineMap[machine.name][dayIndex] = machine.fail_count;

                // Khởi tạo đầy đủ 24 giờ, mỗi giờ có y=0 và custom.details=[]
                let fullHourlyData = Array.from({ length: 24 }, (_, hour) => ({
                    name: `${hour.toString().padStart(2, '0')}:00 - ${hour === 23 ? '00:00' : (hour + 1).toString().padStart(2, '0')}:00`,
                    y: 0,
                    custom: { details: [] }
                }));

                if (Array.isArray(machine.hourly_data)) {
                    machine.hourly_data.forEach(hourItem => {
                        const h = parseInt(hourItem.hour);
                        fullHourlyData[h].y = hourItem.fail_count;

                        // Gán `details` cho giờ tương ứng
                        if (Array.isArray(machine.details)) {
                            fullHourlyData[h].custom.details = machine.details.filter(detail => detail.hour === hourItem.hour);
                        }
                    });
                }

                drilldownSeries.push({
                    id: `${machine.name}-${day.date}`,
                    name: `Detail for ${machine.name} on ${day.date}`,
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
        })).sort((a, b) => {
            const totalA = a.data.reduce((sum, val) => sum + (val || 0), 0);
            const totalB = b.data.reduce((sum, val) => sum + (val || 0), 0);
            return totalB - totalA;
        });
        
        return { dates, seriesData, drilldownSeries };
    }
    function showDetailsModal(details) {
        const modal = document.getElementById('detailsModal2');
        const modalBody = modal.querySelector('.modal-body2');

        // Xóa nội dung cũ
        modalBody.innerHTML = '';

        // Tạo bảng hiển thị details
        const table = document.createElement('table');
        table.classList.add('details-table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Line</th>
                    <th>Machine</th>
                    <th>Time</th>
                    <th>Model Name</th>
                    <th>Serial Number</th>
                    <th>Force 1</th>
                    <th>Force 2</th>
                    <th>Force 3</th>
                    <th>Force 4</th>
                    <th>Min Force</th>
                    <th>Max Force</th>
                    
                </tr>
            </thead>
            <tbody>
                ${details.map(detail => `
                    <tr>
                        <td>${detail.line || 'N/A'}</td>
                        <td>${detail.machine || 'N/A'}</td>
                        <td>${detail.date && detail.time ? `${detail.date} ${detail.time}` : 'N/A'}</td>
                        <td>${detail.model_name || 'N/A'}</td>
                        <td>${detail.serial_number || 'N/A'}</td>
                        <td>${detail.force_1 ?? 'N/A'}</td>
                        <td>${detail.force_2 ?? 'N/A'}</td>
                        <td>${detail.force_3 ?? 'N/A'}</td>
                        <td>${detail.force_4 ?? 'N/A'}</td>                        
                        <td>${detail.min_force ?? 'N/A'}</td>
                        <td>${detail.max_force ?? 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        modalBody.appendChild(table);

        modal.style.display = 'block';
        modal.querySelector('.close-modal2').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    //setup column chart top machine fail per day
    function drawColumnChart(columnData) {
        const { dates, seriesData, drilldownSeries } = processDataColumnChart(columnData);

        if (columnChart) {
            // Lấy danh sách tên series hiện tại và mới
            const currentSeriesNames = columnChart.series.map(s => s.name);
            const newSeriesNames = seriesData.map(s => s.name);

            // Xác định series cần xóa, thêm, hoặc cập nhật
            const seriesToRemove = currentSeriesNames.filter(name => !newSeriesNames.includes(name));
            const seriesToAdd = seriesData.filter(s => !currentSeriesNames.includes(s.name));
            const seriesToUpdate = seriesData.filter(s => currentSeriesNames.includes(s.name));

            // Xóa series không còn trong dữ liệu mới
            seriesToRemove.forEach(name => {
                const series = columnChart.series.find(s => s.name === name);
                if (series) series.remove(false);
            });

            // Thêm series mới
            seriesToAdd.forEach(newSeries => {
                columnChart.addSeries(newSeries, false);
            });

            // Cập nhật dữ liệu cho series hiện có
            seriesToUpdate.forEach(newSeries => {
                const series = columnChart.series.find(s => s.name === newSeries.name);
                if (series) series.setData(newSeries.data, false);
            });

            // Cập nhật trục x và drilldown
            columnChart.xAxis[0].setCategories(dates, false);
            columnChart.update({
                drilldown: { series: drilldownSeries }
            }, false);

            // Vẽ lại biểu đồ
            columnChart.redraw();
            return;
        }

        columnChart = Highcharts.chart('container-toperr', {
            chart: {
                type: 'column',
                backgroundColor: null,
                zooming: { type: 'x' },
                animation: { duration: 600, easing: 'easeOutExpo' }
            },
            subtitle: {
                text: 'Click on the columns to view details',
                align: 'left',
                verticalAlign: 'top',
                style: {
                  fontSize: '12px',
                  color: '#606060'
                }
              },
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
                    categories: Array.from({ length: 24 }, (_, i) => `${i}:00 - ${i + 1}:00`),
                    title: { text: 'Hour', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } },
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
                                const drilldownExists = columnChart.options.drilldown.series.some(d => d.id === drilldownId);

                                if (drilldownExists) {
                                    columnChart.xAxis[0].update({ visible: false });
                                    columnChart.xAxis[1].update({ visible: true });

                                    const drillSeries = columnChart.options.drilldown.series.find(d => d.id === drilldownId);
                                    const seriesData = drillSeries.data.map(item => ({
                                        name: item.name,
                                        y: item.y,
                                        custom: { details: item.custom.details }
                                    }));

                                    columnChart.addSeriesAsDrilldown(this, {
                                        id: drilldownId,
                                        name: `Fail Count`,
                                        data: seriesData,
                                        xAxis: 1
                                    });
                                    columnChart.applyDrilldown();
                                }
                                else if (this.options.custom && this.options.custom.details) {
                                    console.log("Details:", this.options.custom.details);
                                    showDetailsModal(this.options.custom.details);
                                }

                            }
                        }
                    }
                }
            },
            accessibility: { enabled: false },
            series: seriesData,
            drilldown: { series: drilldownSeries },
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

        Highcharts.addEvent(columnChart, 'drillup', function () {
            columnChart.update({
                xAxis: [{ visible: true }, { visible: false }]
            });
        });
    }
    //setup column2 chart screw force trend
    function drawColumn2Chart(data, targetValue, machine, line) {
        try {
            const categories = data.map(item => item.date);
            const passData = data.map(item => isNaN(item.count_pass) ? 0 : item.count_pass);
            const failData = data.map(item => isNaN(item.count_fail) ? 0 : item.count_fail);
            const fpyData = data.map(item => isNaN(item.fpy) ? 0 : item.fpy);
            const titleText = `Screw Force Trend of ${machine || 'Machine NaN'} on ${line || 'Line NaN'}`; 
            if (passData.every(v => v === 0) && failData.every(v => v === 0) && fpyData.every(v => v === 0)) {
                console.warn("No valid data to display in the chart.");
                return;
            }
    
            if (column2Chart) {
                column2Chart.xAxis[0].setCategories(categories);
                column2Chart.series[0].setData(passData, false);
                column2Chart.series[1].setData(failData, false);
                column2Chart.series[2].setData(fpyData, false);
                column2Chart.series[3].setData(Array(categories.length).fill(targetValue), false);
                column2Chart.setTitle({text: titleText}, false);
                column2Chart.redraw();
                return;
            }
            column2Chart = Highcharts.chart('container3', {
                chart: {
                    zooming: { type: 'x' },
                    animation: { duration: 600, easing: 'easeOutExpo' },
                    backgroundColor: null,
                    plotBackgroundColor: null
                },
                title: {
                    text: titleText,
                    align: 'left',
                    style: { color: '#fff', fontSize: '16px', fontWeight: 'bold' }
                },
                credits: { enabled: false },
                accessibility: { enabled: false },
                xAxis: {
                    categories: categories,
                    crosshair: true,
                    labels: { style: { color: '#fff', fontSize: '12px' } },
                    title: { text: 'Day', style: { color: '#fff', fontSize: '12px' } }
                },
                yAxis: [{
                    labels: { format: '{value}°%', style: { color: '#fff' } },
                    title: { text: 'FPY', style: { color: '#fff' } }
                }, {
                    title: { text: 'Count', style: { color: '#fff' } },
                    labels: { format: '{value}', style: { color: '#fff' } },
                    opposite: true
                }],
                tooltip: { shared: true },
                legend: {
                    align: 'center',
                    verticalAlign: 'bottom',
                    itemStyle: { color: '#fff' },
                    itemHoverStyle: { color: '#cccccc' }
                },
                series: [
                    {
                        name: 'Pass',
                        type: 'column',
                        yAxis: 1,
                        data: passData,
                        color: {
                            linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                            stops: [[0, '#007bff'], [1, '#003366']]
                        }
                    },
                    {
                        name: 'Fail',
                        type: 'column',
                        yAxis: 1,
                        data: failData,
                        color: {
                            linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                            stops: [[0, '#f88e8e'], [1, '#f84646']]
                        }
                    },
                    {
                        name: 'FPY',
                        type: 'spline',
                        data: fpyData,
                        tooltip: { valueSuffix: '%' }
                    },
                    {
                        name: 'Target',
                        type: 'line', 
                        data: Array(categories.length).fill(targetValue),
                        color: '#20fc03', 
                        tooltip: { valueSuffix: '%' }, 
                        dashStyle: 'shortdash', 
                        marker: {
                            enabled: false 
                        },
                        dataLabels: {
                            enabled: true,
                            formatter: function() {
                              if (this.point.index === this.series.data.length - 1) {
                                return  'Target';
                              }
                              return null;
                            },
                            align: 'left',
                            verticalAlign: 'top',
                            y: -25,
                            
                            style: {
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#20fc03' 
                              }
                        }
                    },
                ]
            });
    
        } catch (error) {
            console.error('Error generating column2 chart:', error);
        }
    }
    //setup force chart
    function drawForceChart(data) {
        const categories = data.categories;
        type_machine = getCurrentMachineType();
        const machineName = data.machine_name || 'Machine NaN';
        const minForce = data.min_force || 0;
        const maxForce = data.max_force || 0;
        const title = type_machine === 'Glue'
            ? `CPK Glue Force Of ${machineName}`
            : type_machine === 'Shielding'
                ? `CPK Shielding Force Of ${machineName}`
                : `CPK Screw Force Of ${machineName}`;

        const unit = getUnitByType(type_machine);

        try {
            if (forceChart) {
                forceChart.destroy();
            }

            // Kiểm tra và xử lý dữ liệu `data.series`
            const lineSeries = data.series.map((s, index) => ({
                name: s.name,
                type: 'spline',
                data: s.data.map(value => {
                    if (value === null || value === undefined) {
                        console.warn(`Null or undefined value found in series "${s.name}"`);
                        return 0; // Thay thế giá trị null bằng 0
                    }
                    return parseFloat(value.toFixed(2));
                }),
                color: Highcharts.getOptions().colors[index],
                marker: {
                    enabled: false,
                    radius: 3,
                    symbol: 'circle'
                },
                tooltip: {
                    pointFormat: 'Force: {point.y:.2f}',
                }
            }));

            // Tạo đường Min/Max force
            const minLine = {
                name: 'Min Force',
                type: 'line',
                data: Array(categories.length).fill(minForce),
                color: '#fc0335',
                dashStyle: 'ShortDash',
                lineWidth: 2,
                marker: { enabled: false },
                enableMouseTracking: true,
                dataLabels: {
                    enabled: true,
                    formatter: function() {
                        if (this.point.index === this.series.data.length - 1) {
                            return 'LCL';
                        }
                        return null;
                    },
                    align: 'left',
                    verticalAlign: 'top'
                }
            };

            const maxLine = {
                name: 'Max Force',
                type: 'line',
                data: Array(categories.length).fill(maxForce),
                color: '#fc0335',
                dashStyle: 'ShortDash',
                lineWidth: 2,
                marker: { enabled: false },
                enableMouseTracking: true,
                dataLabels: {
                    enabled: true,
                    formatter: function() {
                        if (this.point.index === this.series.data.length - 1) {
                            return 'UCL';
                        }
                        return null;
                    },
                    align: 'left',
                    verticalAlign: 'top'
                }
            };

            const allSeries = [...lineSeries, minLine, maxLine];

            forceChart = Highcharts.chart('container', {
                chart: {
                    type: 'spline',
                    zoomType: 'x',
                    backgroundColor: null,
                    plotBackgroundColor: null,
                    animation: { duration: 600, easing: 'easeOutExpo' },
                },
                title: {
                    text: title,
                    align: 'left',
                    style: { color: '#fff', fontSize: '16px', fontWeight: 'bold' }
                },
                xAxis: {
                    categories: categories,
                    title: { text: 'Time', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } }
                },
                yAxis: {
                    title: {
                        text: 'Force',
                        style: { color: '#fff', fontSize: '12px' }
                    },
                    labels: {
                        format: `{value} ${unit}`,
                        style: { color: '#fff', fontSize: '12px' }
                    }
                },
                legend: {
                    align: 'center',
                    verticalAlign: 'bottom',
                    itemStyle: { color: '#fff' },
                    itemHoverStyle: { color: '#ccc' }
                },
                credits: { enabled: false },
                accessibility: { enabled: false },
                plotOptions: {
                    line: {
                        dataLabels: { enabled: false },
                        enableMouseTracking: true
                    }
                },
                series: allSeries
            });

        } catch (error) {
            console.error('Error rendering force chart:', error);
        }
    }
}
//load dashboard-
function initializeDashboard () {
    const tableBody = document.getElementById("table-body");
    const paginationDiv = document.getElementById("pagination");
    const POLLING_INTERVAL = 300000;
    console.log("Dashboard polling interval :", POLLING_INTERVAL +"ms");
    let chart;
    let isInDrilldown = false;
    let currentDrilldownId = null;
    let column2Chart = null;
    let columnChart = null;
    let forceChart = null;
    let forceLimits = {};
    function initForceLimitsAndLoad() {
        const typeMachine = getCurrentMachineType();
        fetch(`/api/dashboard/getDefaultForce?type_machine=${typeMachine}`)
            .then(res => res.json())
            .then(data => {
                forceLimits = data;
                fetchPage(1);
            })
            .catch(err => {                
                console.error("Lỗi khi lấy ngưỡng lực:", err);
                fetchPage(1);
            });
    }
    function fetchPage(page = 1) {
        const typeMachine = getCurrentMachineType();
        document.getElementById('loading').style.display = 'block';
        fetch(`/api/dashboard/table?page=${page}&type_machine=${typeMachine}`, {
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
        const typeMachine = getCurrentMachineType();
        fetch(`/api/dashboard/charts?type_machine=${typeMachine}`, {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(response => response.json())
        .then(data => {
            if (data.pie_chart_data || data.column_chart_data || data.column2_chart_data || data.data_force_chart) {
                // console.log("Pie chart data:", data.pie_chart_data);
                updatePieChart(data.pie_chart_data);
                drawColumnChart(data.column_chart_data);
                drawColumn2Chart(data.column2_chart_data, 98);
                drawForceChart(data.data_force_chart);
            } else { 
                console.error("Charts data not available.");
            }
        })
        .catch(error => {
            console.error("Error fetching chart data:", error);
            // alert("Error fetch data charts:", error)
        });
    }
    function checkForceValue(line, machine, value) {
        const key = `${line},${machine}`;
        const limits = forceLimits[key];
        if (value === null || value === undefined || value === "N/A") {
        return "force-na";
    }
        if (!limits) return "high-force";
    
        const { min, max } = limits;
        return (value >= min && value <= max) ? "low-force" : "high-force";
    }
    function updateTable(rows) {
        let fragment = document.createDocumentFragment();
        rows.forEach(row => {
            let tr = document.createElement("tr");
            const ths = document.querySelectorAll("table thead tr th");
            type_machine = getCurrentMachineType();
            if (type_machine === 'Glue') {
                ths[4].innerText = 'Weight 1';
                ths[5].innerText = 'Weight 2';
                ths[6].innerText = 'Weight 3';
                ths[7].innerText = 'Weight 4';
            }
            else if (type_machine === 'Screw') {
                ths[4].innerText = 'Force 1';
                ths[5].innerText = 'Force 2';
                ths[6].innerText = 'Force 3';
                ths[7].innerText = 'Force 4';
            }
            tr.innerHTML = `
                <td class ="stt">${row.stt}</td>
                <td>
                ${[row.factory, row.line, row.name_machine].filter(Boolean).join('_') || 'N/A'}
                </td>
                <td>${row.model_name ?? 'N/A'}</td>
                <td>${row.serial_number ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_1)}">${row.force_1 ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_2)}">${row.force_2 ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_3)}">${row.force_3 ?? 'N/A'}</td>
                <td class="${checkForceValue(row.line, row.name_machine,row.force_4)}">${row.force_4 ?? 'N/A'}</td>
                <td class = "time">${row.time_update ?? 'N/A'}</td>
                <td class="${row.result === 'PASS' ? 'state-pass' : 'state-fail'}">${row.result ?? 'N/A'}</td>
            `;
            fragment.appendChild(tr);
        });
        tableBody.innerHTML = "";
        tableBody.appendChild(fragment);
    }
    function updatePagination(currentPage, totalPages) {
        let paginationHTML = "";
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);

        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        if (currentPage > 1) {
            paginationHTML += `<a href="#" class="page-link" data-page="${currentPage - 1}">&laquo;</a>`;
        }
        for (let i = startPage; i <= endPage; i++) {
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
            { name: "Pass", y: pieData.fpyPass, drilldown: "Pass", color: {
                linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                stops: [[0, '#007bff'], [1, '#003366']]
            } },
            { name: "Fail", y: pieData.fpyFail, drilldown: "Fail", color: {
                linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                stops: [[0, '#f88e8e'], [1, '#f84646']]
            } }
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
            subtitle: {
                text: 'Click on the slices to view details',
                align: 'left',
                verticalAlign: 'top',
                style: {
                  fontSize: '12px',
                  color: '#606060'
                }
              },
            title: {
                text: "Pass/Fail By 5 Day Of All Machines",
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

        const dates = [...new Set(columnData.map(item => item.date))].sort((a, b) => new Date(a) - new Date(b));

        let machineMap = {};
        let drilldownSeries = [];
        columnData.forEach(day => {
            const dayIndex = dates.indexOf(day.date);
            if (!day.machines || day.machines.length === 0) return;

            day.machines.sort((a, b) => b.fail_count - a.fail_count);
            day.machines.forEach(machine => {
                if (!machineMap[machine.name]) {
                    machineMap[machine.name] = Array(dates.length).fill(null);
                }
                machineMap[machine.name][dayIndex] = machine.fail_count;

                let fullHourlyData = Array.from({ length: 24 }, (_, hour) => ({
                    name: `${hour.toString().padStart(2, '0')}:00 - ${hour === 23 ? '00:00' : (hour + 1).toString().padStart(2, '0')}:00`,
                    y: 0,
                    custom: { details: [] }
                }));
                if (Array.isArray(machine.hourly_data)) {
                    machine.hourly_data.forEach(hourItem => {
                        const h = parseInt(hourItem.hour);
                        fullHourlyData[h].y = hourItem.fail_count;
                        // Gán `details` cho giờ tương ứng
                        if (Array.isArray(machine.details)) {
                            fullHourlyData[h].custom.details = machine.details.filter(detail => detail.hour === hourItem.hour);
                        }
                    });
                }
                drilldownSeries.push({
                    id: `${machine.name}-${day.date}`,
                    name: `Detail for ${machine.name} on ${day.date}`,
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
        })).sort((a, b) => {
            const totalA = a.data.reduce((sum, val) => sum + (val || 0), 0);
            const totalB = b.data.reduce((sum, val) => sum + (val || 0), 0);
            return totalB - totalA;
        });
        
        return { dates, seriesData, drilldownSeries };
    }
    function showDetailsModal(details) {
        const modal = document.getElementById('detailsModal2');
        const modalBody = modal.querySelector('.modal-body2');
        // Xóa nội dung cũ
        modalBody.innerHTML = '';
        // Tạo bảng hiển thị details
        const table = document.createElement('table');
        table.classList.add('details-table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Line</th>
                    <th>Machine</th>
                    <th>Time</th>
                    <th>Model Name</th>
                    <th>Serial Number</th>
                    <th>Position 1</th>
                    <th>Position 2</th>
                    <th>Position 3</th>
                    <th>Position 4</th>
                    <th>Min Force</th>
                    <th>Max Force</th>
                </tr>
            </thead>
            <tbody>
                ${details.map(detail => `
                    <tr>
                        <td>${detail.line || 'N/A'}</td>
                        <td>${detail.machine || 'N/A'}</td>
                        <td>${detail.date && detail.time ? `${detail.date} ${detail.time}` : 'N/A'}</td>
                        <td>${detail.model_name || 'N/A'}</td>
                        <td>${detail.serial_number || 'N/A'}</td>
                        <td>${detail.force_1 ?? 'N/A'}</td>
                        <td>${detail.force_2 ?? 'N/A'}</td>
                        <td>${detail.force_3 ?? 'N/A'}</td>
                        <td>${detail.force_4 ?? 'N/A'}</td>
                        <td>${detail.min_force ?? 'N/A'}</td>
                        <td>${detail.max_force ?? 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        modalBody.appendChild(table);
        modal.style.display = 'block';
        modal.querySelector('.close-modal2').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    //setup column chart top machine fail per day
    function drawColumnChart(columnData) {
        const { dates, seriesData, drilldownSeries } = processDataColumnChart(columnData);
        if (columnChart) {
            const currentSeriesNames = columnChart.series.map(s => s.name);
            const newSeriesNames = seriesData.map(s => s.name);
            const seriesToRemove = currentSeriesNames.filter(name => !newSeriesNames.includes(name));
            const seriesToAdd = seriesData.filter(s => !currentSeriesNames.includes(s.name));
            const seriesToUpdate = seriesData.filter(s => currentSeriesNames.includes(s.name));

            // Xóa series không còn trong dữ liệu mới
            seriesToRemove.forEach(name => {
                const series = columnChart.series.find(s => s.name === name);
                if (series) series.remove(false);
            });
            // Thêm series mới
            seriesToAdd.forEach(newSeries => {
                columnChart.addSeries(newSeries, false);
            });

            // Cập nhật dữ liệu cho series hiện có
            seriesToUpdate.forEach(newSeries => {
                const series = columnChart.series.find(s => s.name === newSeries.name);
                if (series) series.setData(newSeries.data, false);
            });

            // Cập nhật trục x và drilldown
            columnChart.xAxis[0].setCategories(dates, false);
            columnChart.update({
                drilldown: { series: drilldownSeries }
            }, false);

            // Vẽ lại biểu đồ
            columnChart.redraw();
            return;
        }

        columnChart = Highcharts.chart('container-toperr', {
            chart: {
                type: 'column',
                backgroundColor: null,
                zooming: { type: 'x' },
                animation: { duration: 600, easing: 'easeOutExpo' }
            },
            subtitle: {
                text: 'Click on the columns to view details',
                align: 'left',
                verticalAlign: 'top',
                style: {
                  fontSize: '12px',
                  color: '#606060'
                }
              },
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
                    categories: Array.from({ length: 24 }, (_, i) => `${i}:00 - ${i + 1}:00`),
                    title: { text: 'Hour', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } },
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
                                const drilldownExists = columnChart.options.drilldown.series.some(d => d.id === drilldownId);

                                if (drilldownExists) {
                                    columnChart.xAxis[0].update({ visible: false });
                                    columnChart.xAxis[1].update({ visible: true });

                                    const drillSeries = columnChart.options.drilldown.series.find(d => d.id === drilldownId);
                                    const seriesData = drillSeries.data.map(item => ({
                                        name: item.name,
                                        y: item.y,
                                        custom: { details: item.custom.details }
                                    }));

                                    columnChart.addSeriesAsDrilldown(this, {
                                        id: drilldownId,
                                        name: `Fail Count`,
                                        data: seriesData,
                                        xAxis: 1
                                    });
                                    columnChart.applyDrilldown();
                                }
                                else if (this.options.custom && this.options.custom.details) {
                                    console.log("Details:", this.options.custom.details);
                                    showDetailsModal(this.options.custom.details);
                                }

                            }
                        }
                    }
                }
            },
            accessibility: { enabled: false },
            series: seriesData,
            drilldown: { series: drilldownSeries },
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

        Highcharts.addEvent(columnChart, 'drillup', function () {
            columnChart.update({
                xAxis: [{ visible: true }, { visible: false }]
            });
        });
    }
    //setup column2 chart screw force trend
    function drawColumn2Chart(data, targetValue) {
        try {
            const categories = data.map(item => item.date);
            const passData = data.map(item => isNaN(item.count_pass) ? 0 : item.count_pass);
            const failData = data.map(item => isNaN(item.count_fail) ? 0 : item.count_fail);
            const fpyData = data.map(item => isNaN(item.fpy) ? 0 : item.fpy);
            
            if (column2Chart) {
                column2Chart.xAxis[0].setCategories(categories);
                column2Chart.series[0].setData(passData, false);
                column2Chart.series[1].setData(failData, false);
                column2Chart.series[2].setData(fpyData, false);
                column2Chart.series[3].setData(Array(categories.length).fill(targetValue), false);
                column2Chart.redraw();
                return;
            }
    
            column2Chart = Highcharts.chart('container3', {
                chart: {
                    zooming: { type: 'x' },
                    backgroundColor: null,
                    plotBackgroundColor: null
                },
                title: {
                    text: 'Screw Force Trend Of All Machines',
                    align: 'left',
                    style: { color: '#fff', fontSize: '16px', fontWeight: 'bold' }
                },
                credits: { enabled: false },
                accessibility: { enabled: false },
                xAxis: {
                    categories: categories,
                    crosshair: true,
                    labels: { style: { color: '#fff', fontSize: '12px' } },
                    title: { text: 'Day', style: { color: '#fff', fontSize: '12px' } }
                },
                yAxis: [{
                    labels: { format: '{value}°%', style: { color: '#fff' } },
                    title: { text: 'FPY', style: { color: '#fff' } }
                }, {
                    title: { text: 'Count', style: { color: '#fff' } },
                    labels: { format: '{value}', style: { color: '#fff' } },
                    opposite: true
                }],
                tooltip: { shared: true },
                legend: {
                    align: 'center',
                    verticalAlign: 'bottom',
                    itemStyle: { color: '#fff' },
                    itemHoverStyle: { color: '#cccccc' }
                },
                series: [
                    {
                        name: 'Pass',
                        type: 'column',
                        yAxis: 1,
                        data: passData,
                        color: {
                            linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                            stops: [[0, '#007bff'], [1, '#003366']]
                        }
                    },
                    {
                        name: 'Fail',
                        type: 'column',
                        yAxis: 1,
                        data: failData,
                        color: {
                            linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
                            stops: [[0, '#f88e8e'], [1, '#f84646']]
                        }
                    },
                    {
                        name: 'FPY',
                        type: 'spline',
                        data: fpyData,
                        tooltip: { valueSuffix: '%' }
                    },
                    {
                        name: 'Target',
                        type: 'line', 
                        data: Array(categories.length).fill(targetValue),
                        color: '#20fc03', 
                        tooltip: { valueSuffix: '%' }, 
                        dashStyle: 'shortdash', 
                        marker: {
                            enabled: false 
                        },
                        dataLabels: {
                            enabled: true,
                            formatter: function() {
                              if (this.point.index === this.series.data.length - 1) {
                                return  'Target';
                              }
                              return null;
                            },
                            align: 'left',
                            verticalAlign: 'top',
                            y: -25,
                            x:20,
                            style: {
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#20fc03',
                                zIndex: 10
                              }
                        }
                    },
                    
                    
                ]
            });
    
        } catch (error) {
            console.error('Error generating column2 chart:', error);
        }
    }
    //setup force chart
    function drawForceChart(data) {
        const categories = data.categories;
        type_machine = getCurrentMachineType();
        const machineName = data.machine_name || 'Machine NaN';
        const minForce = data.min_force || 0;
        const maxForce = data.max_force || 0;
        const title = type_machine === 'Glue'
            ? `CPK Glue Force Of ${machineName}`
            : type_machine === 'Shielding'
                ? `CPK Shielding Force Of ${machineName}`
                : `CPK Screw Force Of ${machineName}`;

        const unit = getUnitByType(type_machine);

        try {
            if (forceChart) {
                forceChart.destroy();
            }

            // Kiểm tra và xử lý dữ liệu `data.series`
            const lineSeries = data.series.map((s, index) => ({
                name: s.name,
                type: 'spline',
                data: s.data.map(value => {
                    if (value === null || value === undefined) {
                        console.warn(`Null or undefined value found in series "${s.name}"`);
                        return 0; // Thay thế giá trị null bằng 0
                    }
                    return parseFloat(value.toFixed(2));
                }),
                color: Highcharts.getOptions().colors[index],
                marker: {
                    enabled: false,
                    radius: 3,
                    symbol: 'circle'
                },
                tooltip: {
                    pointFormat: 'Force: {point.y:.2f}',
                }
            }));

            // Tạo đường Min/Max force
            const minLine = {
                name: 'Min Force',
                type: 'line',
                data: Array(categories.length).fill(minForce),
                color: '#fc0335',
                dashStyle: 'ShortDash',
                lineWidth: 2,
                marker: { enabled: false },
                enableMouseTracking: true,
                dataLabels: {
                    enabled: true,
                    formatter: function() {
                        if (this.point.index === this.series.data.length - 1) {
                            return 'LCL';
                        }
                        return null;
                    },
                    align: 'left',
                    verticalAlign: 'top'
                }
            };

            const maxLine = {
                name: 'Max Force',
                type: 'line',
                data: Array(categories.length).fill(maxForce),
                color: '#fc0335',
                dashStyle: 'ShortDash',
                lineWidth: 2,
                marker: { enabled: false },
                enableMouseTracking: true,
                dataLabels: {
                    enabled: true,
                    formatter: function() {
                        if (this.point.index === this.series.data.length - 1) {
                            return 'UCL';
                        }
                        return null;
                    },
                    align: 'left',
                    verticalAlign: 'top'
                }
            };

            const allSeries = [...lineSeries, minLine, maxLine];

            forceChart = Highcharts.chart('container', {
                chart: {
                    type: 'spline',
                    zoomType: 'x',
                    backgroundColor: null,
                    plotBackgroundColor: null,
                    animation: { duration: 600, easing: 'easeOutExpo' },
                },
                title: {
                    text: title,
                    align: 'left',
                    style: { color: '#fff', fontSize: '16px', fontWeight: 'bold' }
                },
                xAxis: {
                    categories: categories,
                    title: { text: 'Time', style: { color: '#fff', fontSize: '12px' } },
                    labels: { style: { color: '#fff', fontSize: '12px' } }
                },
                yAxis: {
                    title: {
                        text: 'Force',
                        style: { color: '#fff', fontSize: '12px' }
                    },
                    labels: {
                        format: `{value} ${unit}`,
                        style: { color: '#fff', fontSize: '12px' }
                    }
                },
                legend: {
                    align: 'center',
                    verticalAlign: 'bottom',
                    itemStyle: { color: '#fff' },
                    itemHoverStyle: { color: '#ccc' }
                },
                credits: { enabled: false },
                accessibility: { enabled: false },
                plotOptions: {
                    line: {
                        dataLabels: { enabled: false },
                        enableMouseTracking: true
                    }
                },
                series: allSeries
            });

        } catch (error) {
            console.error('Error rendering force chart:', error);
        }
    }
    
    function startPolling() {  
        stopPolling();      
        initForceLimitsAndLoad();
        fetchChart();
        pollingTimer = setInterval(() => {
            
            fetchChart();
            fetchPage(page = 1)
        }, POLLING_INTERVAL);
    }
    machineTypeSelect.addEventListener('change', () => {
        const machineType = getCurrentMachineType();
        if (machineType === "Screw") {
            document.getElementById("titleTypeMachine").innerHTML = "Screw machine Information";
        }
        else if (machineType === "Glue") {
            document.getElementById("titleTypeMachine").innerHTML = "Glue machine Information";
        }
        else if (machineType === "Shielding") {
            document.getElementById("titleTypeMachine").innerHTML = "Shielding machine Information";
        }
        else {
            document.getElementById("titleTypeMachine").innerHTML = "Unknown machine type";
        }
        startPolling(); 
        modalSolution();
        downloadExcel();
        modeScreen();
        showCBB();
        fetchContentTop();
    });
    startPolling();
}
function getUnitByType(type_machine) {
    switch (type_machine) {
        case 'Screw':
            return 'kgf.cm';
        case 'Glue':
            return 'g';
        case 'Shielding':
            return 'kgf.cm';
        default:
            return 'kgf.cm';
    }
}
//show list solution
function modalSolution() {
    const downloadButton = document.getElementById('download-excel');
    const cancelDownload = document.getElementById('cancelDownload');
    const solutionButton = document.getElementById('solution');
    const closeModal = document.querySelector(".close-modal");
    const searchInput = document.getElementById('searchError').querySelector('input');
    const table = document.querySelector('.tableSolution');
    const tbody = document.getElementById('tbodySolution');
    const solutionForm = document.getElementById('solutionForm');
    const modal = document.getElementById("solutionModal");
    const btnAdd = document.getElementById('btnadd');
    const modal1 = document.getElementById('modalForm');
    const closeModal1 = document.getElementById('closeModalForm');
    const editButtons = document.querySelectorAll('.btn-edit');
    const deleteButtons = document.querySelectorAll('.btn-delete');
    window.addEventListener("load", adjustTableScroll);
    window.addEventListener("resize", adjustTableScroll);
    
    const style = document.createElement('style');
    document.head.appendChild(style);
    function adjustTableScroll() {
        const tblContent = document.querySelector(".tbl-content");
        const table = tblContent.querySelector("table");
        const scrollWidth = tblContent.offsetWidth - table.offsetWidth;
        document.querySelector(".tbl-header").style.paddingRight = `${scrollWidth}px`;
    }
    adjustTableScroll();
    editButtons.forEach(function(button) {
        button.addEventListener('click', editRowHandler);
    });
    deleteButtons.forEach(function(button) {
        button.addEventListener('click', deleteRowHandler);
    });

    btnAdd.addEventListener('click', function() {
        modal1.style.display = 'block';
    });

    closeModal1.addEventListener('click', function() {
        modal1.style.display = 'none'; 
    });

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal1.style.display = 'none'; 
        }
    });
    // Xử lý sự kiện submit form
    solutionForm.addEventListener('submit', function(event) {
        event.preventDefault();
        type_machine = getCurrentMachineType()
        const formData = new FormData(solutionForm);
        const data = {
            error_code: formData.get('error_code'),
            error_name: formData.get('error_name'),
            root_cause: formData.get('root_cause'),
            solution: formData.get('solution'),
            type_machine: type_machine
        };

        fetch("/api/addDataSolution", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
        if(data.error){
            alert(data.error);
            return;
        }
            alert(data.message);
            console.log('Dữ liệu đã được thêm:', data);
            fetchDataAndUpdateTable(); 
            modal1.style.display = 'none';
            
        })
        .catch(error => {
            console.error('Lỗi khi thêm dữ liệu:', error);
        });
    });
    function fetchDataAndUpdateTable() {
        fetch(`/api/getDataSolution?typeMachine=${getCurrentMachineType()}`)
            .then(response => response.json())
            .then(data => {
                const tbody = document.getElementById('tbodySolution');
                tbody.innerHTML = '';
                data.forEach(item => {
                    const row = document.createElement('tr');
                    row.dataset.id = item.error_code;
                    const formattedSolution = item.solution
                    .replace(/\./g, '.<br>')                   
                    .split('<br>')                             
                    .map(line => line.trim() ? `👉 ${line}` : '')
                    .join('<br>');
                    row.innerHTML = `
                        <td class="errorID">${item.error_code}</td>
                        <td class="errorName">${item.error_name}</td>
                        <td class="errorCause">${item.root_cause}</td>
                        <td class="solutionError">${formattedSolution}</td>
                        <td>
                            <button class="btn btn-edit">Edit</button>
                            <button class="btn btn-delete">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });

                document.querySelectorAll('.btn-edit').forEach(function(button) {
                    button.addEventListener('click', editRowHandler);
                });

                document.querySelectorAll('.btn-delete').forEach(function(button) {
                    button.addEventListener('click', deleteRowHandler);
                });
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    }

    fetchDataAndUpdateTable();

    function performDynamicSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
        const errorCode = row.querySelector('.errorID').textContent.toLowerCase();
        const errorName = row.querySelector('.errorName').textContent.toLowerCase();
        const errorCause = row.querySelector('.errorCause').textContent.toLowerCase();
        const solution = row.querySelector('.solutionError').textContent.toLowerCase();

        const matches = 
            errorCode.includes(searchTerm) || 
            errorName.includes(searchTerm) || 
            errorCause.includes(searchTerm) || 
            solution.includes(searchTerm);

        // Nếu có data thì hiển thị, không thì ẩn
        row.style.display = matches ? '' : 'none';
    });
    const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
    updateSearchResultCount(visibleRows.length, rows.length);
    }
    function updateSearchResultCount(visibleCount, totalCount) {
    console.log(`Tìm thấy ${visibleCount}/${totalCount} kết quả`);
    }
    // Thêm sự kiện tìm kiếm
    searchInput.addEventListener('input', performDynamicSearch);

    // Thêm nút xóa tìm kiếm (tùy chọn)
    function createClearSearchButton() {
    const clearButton = document.createElement('button');
    clearButton.innerHTML = '&times;';
    clearButton.classList.add('clear-search-btn');
    clearButton.style.display = 'none';
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        performDynamicSearch();
        clearButton.style.display = 'none';
    });
    searchInput.parentNode.appendChild(clearButton);
    searchInput.addEventListener('input', () => {
        clearButton.style.display = searchInput.value ? 'inline' : 'none';
    });
    }
    //Tạo nút search khi nhập text
    createClearSearchButton();

    function highlightSearchTerm() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (!searchTerm) return;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td:not(:last-child)');
        cells.forEach(cell => {
            const originalText = cell.textContent;
            const highlightedText = originalText.replace(
                new RegExp(searchTerm, 'gi'), 
                match => `<mark>${match}</mark>`
            );
            cell.innerHTML = highlightedText;
        });
    });
    }

    // Kết hợp highlight với tìm kiếm
    searchInput.addEventListener('input', () => {
    performDynamicSearch();
    highlightSearchTerm();
    });

    // Xử lý khi nhấn "Edit"
    function editRowHandler() {
        const row = this.closest('tr');
        const cells = row.querySelectorAll('td:not(:last-child)');

        cells.forEach(function(cell, index) {
            const text = cell.textContent.trim();
            let inputClass = 'edit-input';
            if (index === 0) return;
            if (index === 1) {
                inputClass += ' input-name';
            } else if (index === 2) {
                inputClass += ' input-cause';
            } else if (index === 3) {
                inputClass += ' input-solution';
                const maxLength = 1000;
                cell.innerHTML = `<textarea class="${inputClass}" style="width:100%; padding:5px;" maxlength="${maxLength}">${text}</textarea>`;
                return;
            }            
            cell.innerHTML = `<input type="text" value="${text}" class="${inputClass}">`;
        });

        this.textContent = 'Save';
        this.classList.remove('btn-edit');
        this.classList.add('btn-save');
        this.removeEventListener('click', editRowHandler);
        this.addEventListener('click', saveRowHandler);
    }
    function saveRowHandler() {
    const row = this.closest('tr');
    const rowId = row.dataset.id;

    if (!rowId) {
        console.error("ID không hợp lệ!");
        return;
    }

    const cells = row.querySelectorAll('td:not(:last-child)');
    const updatedData = {
        error_name: cells[1].querySelector('input').value,
        root_cause: cells[2].querySelector('input').value,
        solution: cells[3].querySelector('textarea').value
    };

    fetch(`/api/updateDataSolution/${rowId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Dữ liệu đã được cập nhật', data);
    })
    .catch(error => {
        console.error('Lỗi khi cập nhật dữ liệu:', error);
    });

    // Cập nhật giao diện
    cells.forEach(function(cell) {
        const input = cell.querySelector('input');
        const textarea = cell.querySelector('textarea');
        if (input) {
            cell.textContent = input.value;
        } else if (textarea) {
            cell.textContent = textarea.value;
        }
    });

    this.textContent = 'Edit';
    this.classList.remove('btn-save');
    this.classList.add('btn-edit');
    this.removeEventListener('click', saveRowHandler);
    this.addEventListener('click', editRowHandler);
    }
    function deleteRowHandler() {
    const row = this.closest('tr');

    const rowId = row.dataset.id;  
    console.log("rowId:", rowId);
    if (!rowId) {
        console.error("ID không hợp lệ!");
        return;
    }
    if (confirm("Do you want to delete this row ?")) {
        fetch(`/api/deleteDataSolution/${rowId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            console.log('Dữ liệu đã được xóa:', data);
            row.remove();
        })
        .catch(error => {
            console.error('Lỗi khi xóa dữ liệu:', error);
        });
    }
    }

    downloadButton.addEventListener('click', function(event) {
    event.preventDefault();
    downloadModal.style.display = 'flex';
    });
    solutionButton.addEventListener('click', function(event) {
    event.preventDefault();
    solutionModal.style.display = 'flex';
    });
    closeModal.addEventListener("click", function () {
    modal.style.display = "none";
    });
    cancelDownload.addEventListener('click', function() {
    downloadModal.style.display = 'none';
    });
    modal.addEventListener("click", function (event) {
    if (event.target === modal) {
        modal.style.display = "none";
    }
    });
}
//download excel
function downloadExcel() {
    const confirmDownload = document.getElementById('confirmDownload');
    if (confirmDownload.dataset.initialized === 'true') return;

    confirmDownload.dataset.initialized = 'true'; 

    confirmDownload.addEventListener('click', async () => {
        toggleModal(false);
        showProgress();

        const payload = getDownloadPayload();
        if (!validatePayload(payload)) {
            alert("Invalid input. Please check your fields.");
            hideProgress();
            return;
        }

        try {
            simulateProgress();

            const response = await sendDownloadRequest(payload);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            triggerDownload(blob);
            completeProgress();
            setTimeout(hideProgress, 500);
        } catch (err) {
            console.error(err);
            alert("Download failed. Please try again.");
            hideProgress();
        }
    });
}
// Utility functions
function getDownloadPayload() {
    const get = (id) => document.getElementById(id)?.value.trim() || null;
    const format = (dt) => dt ? dt.replace('T', ' ') + ':00' : null;
    return {
        factory: get("factory-combobox"),
        model: get("modelNamecombobox"),
        line: get("line-combobox"),
        nameMachine: get("nameMachine-combobox"),
        time_update: format(get("time_update")),
        time_end: format(get("time_end")),
        state: get("state-combobox")
    };
}

function validatePayload(payload) {
    if (payload.time_update && payload.time_end && payload.time_update > payload.time_end) {
        return false;
    }
    return true;
}

function sendDownloadRequest(data) {
    return fetch(`/api/downloadExcel?typeMachine=${getCurrentMachineType()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(data)
    });
}

function simulateProgress() {
    let progress = 0;
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');

    const interval = setInterval(() => {
        if (progress < 90) {
            progress = Math.min(progress + Math.random() * 10, 90);
            bar.style.width = `${progress}%`;
            text.textContent = `${Math.round(progress)}%`;
        } else {
            clearInterval(interval);
        }
    }, 300);

    window._progressInterval = interval;
}

function completeProgress() {
    clearInterval(window._progressInterval);
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('progress-text').textContent = '100%';
}

function triggerDownload(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtered_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
}

function showProgress() {
    document.getElementById('download-progress-container').style.display = 'block';
}

function hideProgress() {
    document.getElementById('download-progress-container').style.display = 'none';
}

function toggleModal(visible) {
    document.getElementById('downloadModal').style.display = visible ? 'block' : 'none';
}
//get content top
function fetchContentTop() {
    const totalRecords = document.getElementById("total-records");
    const outputPass = document.getElementById("pass-records");
    const failRecords = document.getElementById("fail-records");
    const fpyPercentage = document.getElementById("fpy-percentage");
    const typeMachine = getCurrentMachineType();
    fetch(`/api/getinfo?type_machine=${typeMachine}`, {
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
}
//mode screen
function modeScreen(){
    const fullscreenIcon = document.getElementById("fullscreenic");
    const toggleFullscreen = document.getElementById("toggle_fullscreen");
    document.addEventListener("fullscreenchange", function () {
        if (document.fullscreenElement) {
            fullscreenIcon.title = "Exit Fullscreen";
            fullscreenIcon.src = "/static/images/disfullscreen.svg";
        } else {
            fullscreenIcon.title = "Fullscreen";
            fullscreenIcon.src = "/static/images/fullscreen1.svg";
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
}
//show list combobox
function showCBB(){
    const lineCombobox = document.getElementById("line-combobox");
    const factoryCombobox = document.getElementById("factory-combobox");
    const stateCombobox = document.getElementById("state-combobox");
    const nameMachineCombobox = document.getElementById("nameMachine-combobox");

    document.getElementById("factory-combobox").addEventListener("change", function () {
        const factory = this.value;
        resetCombobox("modelNamecombobox");
        resetCombobox("line-combobox");
        resetCombobox("nameMachine-combobox");

        if (factory) {
            fetch(`/api/getCascadingOptions?typeMachine=${getCurrentMachineType()}&factory=${factory}`)
                .then(res => res.json())
                .then(models => populateCombobox("modelNamecombobox", models));
        }
    });

    document.getElementById("modelNamecombobox").addEventListener("change", function () {
        const factory = document.getElementById("factory-combobox").value;
        const model = this.value;
        resetCombobox("line-combobox");
        resetCombobox("nameMachine-combobox");

        if (factory && model) {
            fetch(`/api/getCascadingOptions?typeMachine=${getCurrentMachineType()}&factory=${factory}&model_name=${model}`)
                .then(res => res.json())
                .then(lines => populateCombobox("line-combobox", lines));
        }
    });

    document.getElementById("line-combobox").addEventListener("change", function () {
        const factory = document.getElementById("factory-combobox").value;
        const model = document.getElementById("modelNamecombobox").value;
        const line = this.value;
        resetCombobox("nameMachine-combobox");

        if (factory && model && line) {
            fetch(`/api/getCascadingOptions?typeMachine=${getCurrentMachineType()}&factory=${factory}&model_name=${model}&line=${line}`)
                .then(res => res.json())
                .then(machines => populateCombobox("nameMachine-combobox", machines));
        }
    });

    fetch(`/api/getDataComboboxs?typeMachine=${getCurrentMachineType()}`)
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

            const modelNameCombobox = document.getElementById("modelNamecombobox");
            modelNameCombobox.innerHTML = '<option value="">All</option>';
            data.modelNames.forEach(modelName => {
                const option = document.createElement("option");
                option.value = modelName;
                option.textContent = modelName;
                modelNameCombobox.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Error fetching lines and states:", error);
        });
}

function resetCombobox(id) {
    const cbb = document.getElementById(id);
    cbb.innerHTML = '<option value="">All</option>';
}

function populateCombobox(id, data) {
    const cbb = document.getElementById(id);
    cbb.innerHTML = '<option value="">All</option>';
    const uniqueValues = [...new Set(data)];
    uniqueValues.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        cbb.appendChild(option);
    });
}

//load info overview
function initializeOverview () {
    if (machineTypeSelect) {
        machineTypeSelect.value = "Screw";
    }
    modalSolution();
    downloadExcel();
    modeScreen();
    showCBB();
    fetchContentTop();
}
//Dom all
document.addEventListener('DOMContentLoaded', function() {
    machineTypeSelect = document.getElementById("machine-type");
    getCurrentMachineType = () => machineTypeSelect.value;
    
    
    initializeFilter();
    initializeDashboard();
    initializeOverview();
});
