// Utility Functions
const Utils = {
  formatDatetime(datetime) {
    return datetime ? datetime.replace("T", " ") + ":00" : null;
  },

  fetchData(url, options = {}) {
    document.getElementById("loading").style.display = "block";
    return fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
      },
      ...options,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        console.error(`Error fetching data from ${url}:`, error);
        throw error;
      })
      .finally(
        () => (document.getElementById("loading").style.display = "none")
      );
  },

  updateTable(
    tableBody,
    rows,
    stateClassMap = { PASS: "state-pass", FAIL: "state-fail" }
  ) {
    tableBody.innerHTML = rows
      .map(
        (row) => `
        <tr>
          <td class="stt">${row.stt}</td>
          <td>${row.factory ?? "N/A"}</td>
          <td>${row.line ?? "N/A"}</td>
          <td>${row.name_machine ?? "N/A"}</td>
          <td>${row.model_name ?? "N/A"}</td>
          <td>${row.serial_number ?? "N/A"}</td>
          <td>${row.force_1 ?? "N/A"}</td>
          <td>${row.force_2 ?? "N/A"}</td>
          <td>${row.force_3 ?? "N/A"}</td>
          <td>${row.force_4 ?? "N/A"}</td>
          <td class="time">${row.time_update ?? "N/A"}</td>
          <td class="${stateClassMap[row.state] || ""}">${
          row.state ?? "N/A"
        }</td>
        </tr>
      `
      )
      .join("");
  },

  updatePagination(
    paginationDiv,
    currentPage,
    totalPages,
    groupStart,
    groupEnd,
    onPageClick
  ) {
    paginationDiv.innerHTML = "";
    if (currentPage > 1) {
      paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${
        currentPage - 1
      }">«</a>`;
    }
    for (let i = groupStart; i <= groupEnd; i++) {
      paginationDiv.innerHTML += `<a href="#" class="page-link ${
        i === currentPage ? "active" : ""
      }" data-page="${i}">${i}</a>`;
    }
    if (currentPage < totalPages) {
      paginationDiv.innerHTML += `<a href="#" class="page-link" data-page="${
        currentPage + 1
      }">»</a>`;
    }
    paginationDiv.querySelectorAll(".page-link").forEach((link) =>
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const page = parseInt(link.dataset.page, 10);
        if (!isNaN(page)) onPageClick(page);
      })
    );
  },

  getFilterPayload() {
    return {
      line: document.getElementById("line-combobox").value.trim() || null,
      factory: document.getElementById("factory-combobox").value.trim() || null,
      model: document.getElementById("modelNamecombobox").value.trim() || null,
      nameMachine:
        document.getElementById("nameMachine-combobox").value.trim() || null,
      time_update: Utils.formatDatetime(
        document.getElementById("time_update").value
      ),
      time_end: Utils.formatDatetime(document.getElementById("time_end").value),
      state: document.getElementById("state-combobox").value.trim() || null,
    };
  },
};

// Chart Configurations
const ChartConfigs = {
  pieChartOptions(data, containerId) {
    const passData = [],
      failData = [],
      drilldownPass = [],
      drilldownFail = [];
    data.details.forEach((item) => {
      const target =
        item.state === "PASS"
          ? { data: passData, drilldown: drilldownPass }
          : { data: failData, drilldown: drilldownFail };
      target.data.push({ name: item.model_name, y: item.percentage });
      target.drilldown.push([item.model_name, item.percentage]);
    });

    return {
      chart: { type: "pie", backgroundColor: null, plotBackgroundColor: null },
      title: {
        text: "Rate Pass/Fail By 7 Day",
        align: "left",
        style: { color: "#fff", fontSize: "16px" },
      },
      credits: false,
      accessibility: { enabled: false },
      plotOptions: {
        series: {
          borderRadius: 5,
          dataLabels: [
            { enabled: true, distance: 15, format: "{point.name}" },
            {
              enabled: true,
              distance: "-30%",
              filter: { property: "percentage", operator: ">", value: 5 },
              format: "{point.y:.1f}%",
              style: { fontSize: "1em", color: "#fff", textOutline: "none" },
            },
          ],
        },
      },
      tooltip: {
        headerFormat: '<span style="font-size:12px">{series.name}</span><br>',
        pointFormat:
          '<span style="color:{point.color}">{point.name}</span>: <b>{point.y:.2f}%</b> of total<br/>',
      },
      series: [
        {
          name: "Rate",
          colorByPoint: true,
          data: [
            {
              name: "Pass",
              y: data.fpyPass,
              drilldown: "Pass",
              color: "#337cf2",
            },
            {
              name: "Fail",
              y: data.fpyFail,
              drilldown: "Fail",
              color: "#dc3545",
            },
          ],
        },
      ],
      drilldown: {
        series: [
          { name: "Pass", id: "Pass", data: drilldownPass },
          { name: "Fail", id: "Fail", data: drilldownFail },
        ],
      },
    };
  },

  updatePieChart(data, containerId, chartRef) {
    const options = ChartConfigs.pieChartOptions(data, containerId);
    if (chartRef.chart) {
      chartRef.chart.series[0].setData(options.series[0].data);
      chartRef.chart.drilldown.update({ series: options.drilldown.series });
    } else {
      chartRef.chart = Highcharts.chart(containerId, {
        ...options,
        events: {
          drilldown: (e) => {
            chartRef.isInDrilldown = true;
            chartRef.currentDrilldownId = e.point.drilldown;
          },
          drillup: () => {
            chartRef.isInDrilldown = false;
            chartRef.currentDrilldownId = null;
          },
        },
      });
    }
  },

  processColumnChartData(columnData) {
    if (!columnData || !columnData.length)
      return { dates: [], seriesData: [], drilldownSeries: [] };
    const dates = [...new Set(columnData.map((item) => item.date))].sort(
      (a, b) => new Date(a) - new Date(b)
    );
    const machineMap = {};
    const drilldownSeries = [];

    columnData.forEach((day) => {
      const dayIndex = dates.indexOf(day.date);
      if (!day.machines?.length) return;
      day.machines.forEach((machine) => {
        if (!machineMap[machine.name])
          machineMap[machine.name] = Array(dates.length).fill(null);
        machineMap[machine.name][dayIndex] = machine.fail_count;

        const hourlyData = Array(24)
          .fill(0)
          .map((_, i) => [i, 0]);
        (machine.hourly_data || []).forEach(
          (hourItem) =>
            (hourlyData[parseInt(hourItem.hour)][1] = hourItem.fail_count)
        );
        drilldownSeries.push({
          id: `${machine.name}-${day.date}`,
          name: `Detail for ${machine.name} on ${day.date}`,
          data: hourlyData,
          xAxis: 1,
        });
      });
    });

    return {
      dates,
      seriesData: Object.entries(machineMap).map(([name, data]) => ({
        name,
        data,
        drilldown: name,
      })),
      drilldownSeries,
    };
  },

  drawColumnChart(containerId, columnData) {
    const { dates, seriesData, drilldownSeries } =
      ChartConfigs.processColumnChartData(columnData);
    return Highcharts.chart(containerId, {
      chart: { type: "column", backgroundColor: null, zooming: { type: "x" } },
      title: {
        text: "Top 3 Machine Fail Per Day",
        align: "left",
        style: { color: "#fff", fontSize: "16px", fontWeight: "bold" },
      },
      xAxis: [
        {
          categories: dates,
          title: { text: "Day", style: { color: "#fff" } },
          labels: { style: { color: "#fff" } },
          visible: true,
        },
        {
          categories: Array.from(
            { length: 24 },
            (_, i) => `${i}:00 - ${i + 1}:00`
          ),
          title: { text: "Hour", style: { color: "#fff" } },
          labels: { style: { color: "#fff" } },
          visible: false,
        },
      ],
      yAxis: {
        min: 0,
        title: { text: "Fail Count", style: { color: "#fff" } },
        labels: { style: { color: "#fff" } },
      },
      tooltip: { shared: true, useHTML: true },
      plotOptions: {
        column: { groupPadding: 0.1, stacking: "normal" },
        series: {
          cursor: "pointer",
          dataLabels: { enabled: true },
          point: {
            events: {
              click() {
                const drilldownId = `${this.series.name}-${this.category}`;
                if (
                  this.series.chart.options.drilldown.series.some(
                    (d) => d.id === drilldownId
                  )
                ) {
                  this.series.chart.xAxis[0].update({ visible: false });
                  this.series.chart.xAxis[1].update({ visible: true });
                  this.series.chart.addSeriesAsDrilldown(this, {
                    id: drilldownId,
                    name: "Fail Count",
                    data: drilldownSeries.find((d) => d.id === drilldownId)
                      .data,
                    xAxis: 1,
                  });
                }
              },
            },
          },
        },
      },
      series: seriesData,
      drilldown: { series: drilldownSeries },
      credits: { enabled: false },
      legend: {
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { color: "#fff" },
      },
    });
  },

  drawColumn2Chart(containerId, data) {
    const categories = data.map((item) => item.date);
    const passData = data.map((item) => item.count_pass || 0);
    const failData = data.map((item) => item.count_fail || 0);
    const fpyData = data.map((item) => item.fpy || 0);

    if (
      !passData.some((v) => v) &&
      !failData.some((v) => v) &&
      !fpyData.some((v) => v)
    )
      return;

    Highcharts.chart(containerId, {
      chart: { zooming: { type: "x" }, backgroundColor: null },
      title: {
        text: "Screw Force Trend",
        align: "left",
        style: { color: "#fff", fontSize: "16px", fontWeight: "bold" },
      },
      credits: { enabled: false },
      accessibility: { enabled: false },
      xAxis: {
        categories,
        crosshair: true,
        title: { text: "Day", style: { color: "#fff" } },
        labels: { style: { color: "#fff" } },
      },
      yAxis: [
        {
          title: { text: "FPY", style: { color: "#fff" } },
          labels: { format: "{value}%", style: { color: "#fff" } },
        },
        {
          title: { text: "Count", style: { color: "#fff" } },
          labels: { style: { color: "#fff" } },
          opposite: true,
        },
      ],
      tooltip: { shared: true },
      legend: {
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { color: "#fff" },
      },
      series: [
        {
          name: "Pass",
          type: "column",
          yAxis: 1,
          data: passData,
          color: {
            linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
            stops: [
              [0, "#007bff"],
              [1, "#003366"],
            ],
          },
        },
        {
          name: "Fail",
          type: "column",
          yAxis: 1,
          data: failData,
          color: {
            linearGradient: { x1: 0, y1: 1, x2: 0, y2: 0 },
            stops: [
              [0, "#f88e8e"],
              [1, "#f84646"],
            ],
          },
        },
        {
          name: "FPY",
          type: "spline",
          data: fpyData,
          tooltip: { valueSuffix: " %" },
        },
      ],
    });
  },
};

// Main Application Logic
document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("table-body");
  const paginationDiv = document.getElementById("pagination");
  const POLLING_INTERVAL = 60000;
  let currentPage = 1;
  let isFiltering = false;
  const chartState = {
    chart: null,
    isInDrilldown: false,
    currentDrilldownId: null,
  };

  // Scrollable Table Header Adjustment
  $(window)
    .on("load resize", () => {
      const scrollWidth =
        $(".tbl-content").width() - $(".tbl-content table").width();
      $(".tbl-header").css({ "padding-right": scrollWidth });
    })
    .resize();

  // Filter Logic
  document.getElementById("filter").addEventListener("click", (e) => {
    e.preventDefault();
    isFiltering = true;
    clearInterval(pollingTimer);
    fetchFilteredData(1);
  });

  function fetchFilteredData(page, isPagination = false) {
    const payload = { ...Utils.getFilterPayload(), page, per_page: 10 };
    Utils.fetchData("/filter", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then((data) => {
        if (data.success) {
          document.getElementById("count").textContent = data.message || "";
          Utils.updateTable(tableBody, data.data);
          Utils.updatePagination(
            paginationDiv,
            data.current_page,
            data.total_pages,
            data.group_start,
            data.group_end,
            (p) => fetchFilteredData(p, true)
          );
          if (data.total_records === 0) {
            tableBody.innerHTML =
              '<tr><td class="no-data" colspan="12">No data found.</td></tr>';
            paginationDiv.innerHTML = "";
          }
          if (!isPagination) {
            Utils.fetchData("/filterPieChart", {
              method: "POST",
              body: JSON.stringify({
                time_update: payload.time_update,
                time_end: payload.time_end,
              }),
            }).then(
              (d) =>
                d.success &&
                ChartConfigs.updatePieChart(
                  d.pie_chart_date,
                  "container-pie",
                  chartState
                )
            );
            Utils.fetchData("/filterColumnChart", {
              method: "POST",
              body: JSON.stringify({
                time_update: payload.time_update,
                time_end: payload.time_end,
              }),
            }).then(
              (d) =>
                d.success &&
                ChartConfigs.drawColumnChart(
                  "container-toperr",
                  d.column_chart_date
                )
            );
            Utils.fetchData("/filterColumn2Chart", {
              method: "POST",
              body: JSON.stringify({
                time_update: payload.time_update,
                time_end: payload.time_end,
              }),
            }).then(
              (d) =>
                d.success &&
                ChartConfigs.drawColumn2Chart(
                  "container3",
                  d.column2_chart_date
                )
            );
          }
        } else {
          tableBody.innerHTML = '<tr><td colspan="12">No data found.</td></tr>';
          paginationDiv.innerHTML = "";
        }
      })
      .catch(() => {
        tableBody.innerHTML =
          '<tr><td colspan="12">An error occurred while loading data.</td></tr>';
        paginationDiv.innerHTML = "";
      });
  }

  // Dashboard Polling
  let pollingTimer;
  function startPolling() {
    fetchPage(currentPage);
    Utils.fetchData("/api/dashboard/charts").then((data) => {
      ChartConfigs.updatePieChart(
        data.pie_chart_data,
        "container-pie",
        chartState
      );
      ChartConfigs.drawColumnChart("container-toperr", data.column_chart_data);
      ChartConfigs.drawColumn2Chart("container3", data.column2_chart_data);
    });
    pollingTimer = setInterval(() => {
      if (!isFiltering) {
        fetchPage(currentPage);
        Utils.fetchData("/api/dashboard/charts").then((data) => {
          ChartConfigs.updatePieChart(
            data.pie_chart_data,
            "container-pie",
            chartState
          );
          ChartConfigs.drawColumnChart(
            "container-toperr",
            data.column_chart_data
          );
          ChartConfigs.drawColumn2Chart("container3", data.column2_chart_data);
        });
      }
    }, POLLING_INTERVAL);
  }

  function fetchPage(page) {
    Utils.fetchData(`/api/dashboard/table?page=${page}`)
      .then((data) => {
        Utils.updateTable(tableBody, data.data);
        document.getElementById("count").textContent = "";
        Utils.updatePagination(
          paginationDiv,
          data.page,
          data.total_pages,
          data.group_start,
          data.group_end,
          fetchPage
        );
      })
      .catch(() => {
        tableBody.innerHTML = '<tr><td colspan="12">No data found.</td></tr>';
        paginationDiv.innerHTML = "";
      });
  }

  startPolling();

  // Overview Info
  const POLLING_INFO_INTERVAL = 300000;
  function fetchOverview() {
    Utils.fetchData("/getinfo")
      .then((data) => {
        document.getElementById("total-records").textContent =
          data.total || "N/A";
        document.getElementById("pass-records").textContent =
          data.output || "N/A";
        document.getElementById("fail-records").textContent =
          data.fail || "N/A";
        document.getElementById("fpy-percentage").textContent = `${
          data.fpy?.toFixed(2) || "N/A"
        }%`;
      })
      .finally(() => setTimeout(fetchOverview, POLLING_INFO_INTERVAL));
  }
  fetchOverview();

  // Combobox Population
  Utils.fetchData("/getDataComboboxs").then((data) => {
    const populateCombobox = (id, items) => {
      const combobox = document.getElementById(id);
      combobox.innerHTML =
        '<option value="">All</option>' +
        items
          .map((item) => `<option value="${item}">${item}</option>`)
          .join("");
    };
    populateCombobox("line-combobox", data.lines);
    populateCombobox("factory-combobox", data.factories);
    populateCombobox("state-combobox", data.states);
    populateCombobox("nameMachine-combobox", data.nameMachines);
    populateCombobox("modelNamecombobox", data.modelNames);
  });

  // Fullscreen Toggle
  const fullscreenIcon = document.getElementById("fullscreenic");
  document
    .getElementById("toggle_fullscreen")
    .addEventListener("click", (e) => {
      e.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    });
  document.addEventListener("fullscreenchange", () => {
    fullscreenIcon.src = document.fullscreenElement
      ? "/static/images/disfullscreen.png"
      : "/static/images/fullscreen1.png";
    fullscreenIcon.title = document.fullscreenElement
      ? "Exit Fullscreen"
      : "Fullscreen";
  });

  // Modal Download
  const downloadModal = document.getElementById("downloadModal");
  document.getElementById("download-excel").addEventListener("click", (e) => {
    e.preventDefault();
    downloadModal.style.display = "flex";
  });
  document
    .getElementById("cancelDownload")
    .addEventListener("click", () => (downloadModal.style.display = "none"));
  document.getElementById("confirmDownload").addEventListener("click", () => {
    downloadModal.style.display = "none";
    const payload = Utils.getFilterPayload();
    Utils.fetchData("/downloadExcel", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `filtered_data_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      })
      .catch(() =>
        alert("Failed to download the Excel file. Please try again.")
      );
  });

  // Solution Modal
  const solutionModal = document.getElementById("solutionModal");
  document.getElementById("solution").addEventListener("click", (e) => {
    e.preventDefault();
    solutionModal.style.display = "flex";
  });
  document
    .querySelector(".close-modal")
    .addEventListener("click", () => (solutionModal.style.display = "none"));
  solutionModal.addEventListener("click", (e) => {
    if (e.target === solutionModal) solutionModal.style.display = "none";
  });
});
