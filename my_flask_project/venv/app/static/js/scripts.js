//scroll data in table
$(window).on("load resize ", function() {
    var scrollWidth = $('.tbl-content').width() - $('.tbl-content table').width();
    $('.tbl-header').css({'padding-right':scrollWidth});
    }).resize();
//Load data table
// Bắt sự kiện click của nút "Search"
document.getElementById('filter').addEventListener('click', function() {
    // Lấy giá trị từ các input
    const line = document.getElementById('line').value.trim();
    const time_update = document.getElementById('time_update').value.trim();
    const state = document.getElementById('state').value.trim();
    const payload = {
        line: line !== '' ? line : null,
        time_update: time_update !== '' ? time_update : null,
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
  
