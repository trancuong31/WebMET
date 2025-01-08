// URL của backend
const BASE_URL = 'http://127.0.0.1:5000';

// Hàm login
async function login(username, password) {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }), 
      credentials: 'include', // Để gửi cookie
    });

    if (response.ok) {
      console.log('Login successful');
      window.location.href = '/index1'; 
    } else {
      const errorData = await response.json();
      alert(errorData.error || 'Login failed');
    }
  } catch (error) {
    console.error('Error logging in:', error);
  }
}
$(document).ready(function () {
  let currentPage = 1; // Trang hiện tại
  const perPage = 5; // Số bản ghi mỗi trang
  const loadingDiv = $("#loading");

  // Hàm hiển thị hoặc ẩn loading
  function showLoading(show) {
    if (show) {
      loadingDiv.show();
    } else {
      loadingDiv.hide();
    }
  }

  // Hàm tải dữ liệu từ backend
  function loadTasks(page) {
    showLoading(true); // Hiển thị loading
    $.get(
      `http://localhost:5000/tasks?page=${page}&per_page=${perPage}`,
      function (response) {
        const data = response.data;
        const tableBody = $("#tasks-table tbody");
        tableBody.empty();

        data.forEach(function (task) {
          const row = `
            <tr>
              <td>${task.MACHINE_NO}</td>
              <td>${task.NG_QTY !== null ? task.NG_QTY : 0}</td>
              <td>${task.RUN_TIME}</td>
              <td>${task.WORK_DATE}</td>
              <td>
                <button class="delete-btn" data-id="${task.MACHINE_NO}">
                  Delete
                </button>
              </td>
            </tr>`;
          tableBody.append(row);
        });

        // Cập nhật thông tin trang
        $("#current-page").text(`Page ${response.page}`);
        $("#prev-page").prop("disabled", response.page <= 1);
        $("#next-page").prop(
          "disabled",
          response.page >= response.total_pages
        );

        showLoading(false); // Ẩn loading
      }
    ).fail(function () {
      alert("Failed to load data.");
      showLoading(false);
    });
  }

  // Tải dữ liệu trang đầu tiên
  loadTasks(currentPage);

  // Sự kiện nút Previous
  $("#prev-page").click(function () {
    if (currentPage > 1) {
      currentPage--;
      loadTasks(currentPage);
    }
  });

  // Sự kiện nút Next
  $("#next-page").click(function () {
    currentPage++;
    loadTasks(currentPage);
  });
});
// Hàm làm mới token
async function refreshToken() {
  try {
    const response = await fetch(`${BASE_URL}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      console.log('Token refreshed successfully');
    } else {
      console.error('Refresh token failed');
      window.location.href = '/login'; 
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    window.location.href = '/login';
  }
}

// Gọi hàm getData khi trang được tải
document.addEventListener('DOMContentLoaded', getData);