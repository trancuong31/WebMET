from flask import Flask, request, jsonify, abort, render_template, redirect
import oracledb
from flask_cors import CORS
import random
app = Flask(__name__)

# Thông tin kết nối đến Oracle Database
DB_CONFIG = {
    "username": "system",
    "password": "123456",
    "dsn": "localhost:1521/orcl3"
}
CORS(app) 
# Hàm kết nối Oracle
def get_db_connection():
    try:
        connection = oracledb.connect(
            user="system",
            password="123456",
            dsn="localhost:1521/orcl3"
        )
        return connection
    except oracledb.DatabaseError as e:
        print(f"Lỗi kết nối cơ sở dữ liệu: {e}")
        abort(500, description="Không thể kết nối cơ sở dữ liệu.")
@app.route('/configForm', methods=['GET'])
def show_form():
    return render_template('index.html') 
# API: Lấy danh sách thông tin bảng CNT_MACHINE_SUMMARY
@app.route('/tasks', methods=['GET'])
def get_tasks():
    # Kết nối cơ sở dữ liệu
    connection = get_db_connection()
    cursor = connection.cursor()

    # Lấy tham số phân trang từ request
    page = int(request.args.get('page', 1))  # Trang hiện tại (mặc định = 1)
    per_page = int(request.args.get('per_page', 5))  # Số bản ghi mỗi trang (mặc định = 5)

    # Tính toán offset
    offset = (page - 1) * per_page
    try:
        # Đếm tổng số bản ghi
        cursor.execute("SELECT COUNT(*) FROM CNT_MACHINE_SUMMARY")
        total_records = cursor.fetchone()[0]  # Tổng số bản ghi
        total_pages = (total_records + per_page - 1) // per_page  # Tính tổng số trang (làm tròn lên)

        # Truy vấn dữ liệu theo phân trang
        query = """
            SELECT MACHINE_NO, WORK_DATE, RUN_TIME, NG_QTY
            FROM CNT_MACHINE_SUMMARY
            ORDER BY WORK_DATE DESC
            OFFSET :offset ROWS FETCH NEXT :per_page ROWS ONLY
        """
        cursor.execute(query, {"offset": offset, "per_page": per_page})
        rows = cursor.fetchall()

        # Chuẩn bị dữ liệu trả về
        tasks = [
            {"MACHINE_NO": row[0], "WORK_DATE": row[1], "RUN_TIME": row[2], "NG_QTY": row[3] or 0}
            for row in rows
        ]

        # Tạo phản hồi JSON
        response = {
            "data": tasks,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "total_records": total_records
        }
        return jsonify(response)

    except Exception as e:
        # Xử lý lỗi nếu có vấn đề
        return jsonify({"error": str(e)}), 500

    finally:
        # Đảm bảo đóng kết nối cơ sở dữ liệu
        cursor.close()
        connection.close()


# API: Lấy công việc theo ID
@app.route('/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM CNT_MACHINE_SUMMARY WHERE NG_QTY = :id", {"id": task_id})
    row = cursor.fetchone()
    cursor.close()
    connection.close()
    if row:
        return jsonify({"MACHINE_NO": row[0], "WORK_DATE": row[1], "RUN_TIME": row[2]})
    else:
        abort(404, description="Công việc không tồn tại.")

# API: Tạo công việc mới
@app.route('/tasks', methods=['POST'])
def create_task():
    if not request.json:
        abort(400, description="Yêu cầu không hợp lệ.")
    machine_no = request.json["MACHINE_NO"]
    run_time = request.json.get("RUN_TIME", False)

    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO CNT_MACHINE_SUMMARY (MACHINE_NO, RUN_TIME) VALUES (:machine_no, :run_time)",
        {"MACHINE_NO": machine_no, "RUN_TIME": int(run_time)}
    )
    connection.commit()
    cursor.close()
    connection.close()

    return jsonify({"MACHINE_NO": machine_no, "RUN_TIME": run_time}), 201

@app.route('/tasks/<string:MACHINE_NO>', methods=['PUT'])
def update_task(MACHINE_NO):
    if not request.json:
        abort(400, description="Yêu cầu không hợp lệ.")
    
    # Lấy dữ liệu từ JSON
    run_time = request.json.get("RUN_TIME")
    
    # Nếu không có RUN_TIME, trả về lỗi
    if run_time is None:
        abort(400, description="Thiếu tham số RUN_TIME.")
    
    connection = get_db_connection()
    cursor = connection.cursor()
    
    # Cập nhật thông tin MACHINE_NO và RUN_TIME
    cursor.execute(
        """
        UPDATE CNT_MACHINE_SUMMARY 
        SET RUN_TIME = NVL(:run_time, RUN_TIME) 
        WHERE MACHINE_NO = :machine_no
        """,
        {"run_time": int(run_time), "machine_no": MACHINE_NO}
    )
    
    updated_rows = cursor.rowcount
    connection.commit()
    cursor.close()
    connection.close()

    # Kiểm tra xem có bản ghi nào được cập nhật không
    if updated_rows == 0:
        abort(404, description="Công việc không tồn tại.")
    
    # Trả về thông tin đã được cập nhật
    return jsonify({"MACHINE_NO": MACHINE_NO, "RUN_TIME": run_time})

@app.route('/tasks/<string:MACHINE_NO>', methods=['DELETE'])
def delete_task(MACHINE_NO):  # Tham số trùng với định nghĩa route
    connection = get_db_connection()
    cursor = connection.cursor()
    if MACHINE_NO == "null" or MACHINE_NO.strip() == "":
        MACHINE_NO = None
        jsonify({"error": "Machine_no không tồn tại"}), 400
    # Thực thi lệnh DELETE với MACHINE_NO
    cursor.execute(
        "DELETE FROM CNT_MACHINE_SUMMARY WHERE MACHINE_NO = :machine_no OR (:machine_no IS NULL AND MACHINE_NO IS NULL)", 
        {"machine_no": MACHINE_NO}  # Truyền đúng tên tham số
    )
    deleted_rows = cursor.rowcount
    connection.commit()
    cursor.close()
    connection.close()

    # Nếu không xóa được dòng nào, trả về lỗi 404
    if deleted_rows == 0:
        abort(404, description="Công việc không tồn tại.")
    
    # Trả về kết quả thành công
    return jsonify({"result": True})
    
@app.route('/tasks/submitConfig', methods=['POST'])
def submitConfig():
    try:
        # Lấy dữ liệu từ form
        machine_no = request.form.get('machineNo')
        factory = request.form.get('factory')
        status = request.form.get('status')
        project_name = request.form.get('projectName')
        if not all([machine_no, factory, status, project_name]):
            return jsonify({"error": "Missing required fields"}), 400
        connection = get_db_connection()
        cursor = connection.cursor()
        sql = """
            INSERT INTO CNT_MACHINE_INFO (MACHINE_NO, FACTORY, STATUS, PROJECT_NAME)
            VALUES (:machine_no, :factory, :status, :project_name)
        """
        cursor.execute(sql, {
            "machine_no": machine_no,
            "factory": factory,
            "status": int(status),
            "project_name": project_name
        })
        connection.commit()
        cursor.close()

        return render_template('/result.html')

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/returnHome', methods=['GET'])
def returnHome():
    return render_template('/index.html')

@app.route('/countMachine', methods=['GET'])
def getCountMachine():
    connection = get_db_connection()
    cursor= connection.cursor()
    sql= """SELECT COUNT(*) FROM CNT_MACHINE_INFO"""
    cursor.execute(sql)
    result = cursor.fetchone()
    countt= result[0]
    cursor.close()
    connection.close()
    return countt

@app.route('/chartData')
def chart_data():
    # Tạo dữ liệu mẫu
    connection = get_db_connection()
    cursor = connection.cursor()
    sql = """
        SELECT ERROR_CODE, COUNT(ERROR_CODE)
        FROM AUTOMATION_DATA_DETAIL
        GROUP BY ERROR_CODE
        ORDER BY COUNT(ERROR_CODE)
    """
    cursor.execute(sql)
    result = cursor.fetchall()
    labels = [row[0] for row in result]
    data1 = [row[1] for row in result]
    data = {
        "labels": labels,
        "datasets": [{
            "label": "Count",
            "data": data1,
            "backgroundColor": [
                "rgb(255, 99, 132)",
                "rgb(54, 162, 235)",
                "rgb(255, 205, 86)",
                "rgb(255, 125, 86)",
                "rgb(255, 205, 336)",
                "rgb(55, 43, 86)",
                "rgb(5, 105, 86)"
            ] * len(labels),
            "hoverOffset": 4
        }]
    }
    return jsonify(data)
if __name__=='__main__':
    app.run(debug=True)

