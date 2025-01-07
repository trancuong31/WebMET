from flask import Flask, request, jsonify, abort, render_template, redirect, flash, send_file, make_response, url_for, send_from_directory
import oracledb, datetime
from flask_cors import CORS
import jwt
import os, io
from werkzeug.utils import secure_filename
import pandas as pd
app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'
# Thông tin kết nối đến Oracle Database
DB_CONFIG = {
    "username": "system",
    "password": "123456",
    "dsn": "localhost:1521/orcl3"
}
# Thư mục lưu file tải lên
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Cho phép các loại file
ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'jpg', 'jpeg', 'png'}
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
    token = request.cookies.get('token')
    if not token:
        return redirect(('login'))
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        username = data['username']
    except jwt.ExpiredSignatureError:
        flash('Token has expired, please log in again.', 'error')
        return redirect(('login'))
    except jwt.InvalidTokenError:
        flash('Invalid token, please log in again.', 'error')
        return redirect(('login'))
    return render_template('index.html', username=username)
@app.route('/adminDashboard', methods=['GET'])
def admin_dashboard():
    token = request.cookies.get('token')
    if not token:
        return redirect(url_for('login'))
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        username = data['username']
        if username != 'admin':
            return redirect(url_for('login'))
    except jwt.ExpiredSignatureError:
        flash('Token has expired, please log in again.', 'error')
        return redirect(url_for('login'))
    except jwt.InvalidTokenError:
        flash('Invalid token, please log in again.', 'error')
        return redirect(url_for('login'))
    return render_template('adminDashboard.html', username=username)

@app.route('/index1', methods=['GET'])
def index1():
    return render_template('index1.html')

@app.route('/dashboard', methods=['GET'])
def dashboard():
    return render_template('dashboard.html')

@app.route('/logout', methods=['GET'])
def logout():
    resp = make_response(redirect(('login')))
    resp.delete_cookie('token')
    return resp
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username').strip()
        password = request.form.get('password').strip()
        # Kết nối tới cơ sở dữ liệu
        try:
            connection = get_db_connection()
            cursor = connection.cursor()
            query = """
                SELECT 1
                FROM USERS
                WHERE USERNAME = :username AND PASSWORD = :password
            """
            cursor.execute(query, {"username": username, "password": password})
            rows = cursor.fetchone()
            if rows and rows[0] > 0:
                token = jwt.encode({
                    'username': username,
                    'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1) ,
                    'type': 'access'
                }, app.config['SECRET_KEY'], algorithm='HS256')
                refresh_token = jwt.encode({
                    'username' : username,
                    'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7),
                    'type': 'refresh'
                }, app.config['SECRET_KEY'], algorithm='HS256')
                if username == 'admin':
                    resp = make_response(redirect(('adminDashboard')))
                else:
                    resp = make_response(redirect(('index1')))
                resp.set_cookie('token', token, httponly=True, secure=True, max_age=60*60) #1h
                resp.set_cookie('refresh_token', refresh_token, httponly=True, secure=True, max_age=7*24*60*60) #7 days  
                return resp
            else:
                return render_template('login.html', error='Incorrect username or password')
        except Exception as e:
            flash(f"Database error: {e}", "error")
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    return render_template('login.html')

@app.route('/refresh', methods=['POST'])
def refresh():
    refresh_token = request.cookies.get('refresh_token')
    if not refresh_token:
        return redirect(url_for('login'))
    try:
        data = jwt.decode(refresh_token, app.config['SECRET_KEY'], algorithms=['HS256'])
        if data['type'] != 'refresh':
            return jsonify({"error": "Invalid token type"}), 401
        
        new_access_token = jwt.encode({
            'username': data['username'],
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours= 1),
            'type' : 'access'
        }, app.config['SECRET_KEY'], algorithm='HS256')
        resp = make_response(jsonify({"message": 'Token refreshed!'}))
        resp.set_cookie('token', new_access_token, httponly=True, secure=True, max_age=60*60) #1h
        return resp
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Refresh token has expired"}), 401
    except jwt.invalidTokenError:
        return jsonify({"error": "Invalid refresh token"}), 401

@app.route('/register', methods=['GET', 'POST'])
def register():
    try:
        if request.method == 'POST':
            # Xử lý dữ liệu đăng ký
            username = request.form.get('username')
            password = request.form.get('password')
            email = request.form.get('email')
            # Thêm thông tin người dùng vào cơ sở dữ liệu
            connection = get_db_connection()
            cursor = connection.cursor()
            query = """
                SELECT 1
                FROM USERS
                WHERE USERNAME = :username 
            """
            cursor.execute(query, {"username": username})
            rows = cursor.fetchone()
            if rows:
                return render_template('register.html', error='User already exists')
            else:
                insert_query = """
                    INSERT INTO USERS (USERNAME, PASSWORD, EMAIL)
                    VALUES (:username, :password, :email)
                """
                cursor.execute(insert_query, {"username": username, "password": password, "email" : email})
                connection.commit()
                cursor.close()
                connection.close()
                return redirect('login')

        return render_template('register.html')
    except Exception as e:
        flash(f"Database error: {e}", "error")

# API: Lấy danh sách thông tin bảng CNT_MACHINE_SUMMARY
@app.route('/tasks', methods=['GET'])
def get_tasks():
    # Kết nối cơ sở dữ liệu
    connection = get_db_connection()
    cursor = connection.cursor()

    # Lấy tham số phân trang từ request
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 5))

    # Tính toán offset
    offset = (page - 1) * per_page
    try:
        # Đếm tổng số bản ghi
        cursor.execute("SELECT COUNT(*) FROM CNT_MACHINE_SUMMARY")
        total_records = cursor.fetchone()[0]  # Tổng số bản ghi
        total_pages = (total_records + per_page - 1) // per_page
        query = """
            SELECT MACHINE_NO, WORK_DATE, RUN_TIME, NG_QTY
            FROM CNT_MACHINE_SUMMARY
            ORDER BY WORK_DATE DESC
            OFFSET :offset ROWS FETCH NEXT :per_page ROWS ONLY
        """
        cursor.execute(query, {"offset": offset, "per_page": per_page})
        rows = cursor.fetchall()
        tasks = [
            {"MACHINE_NO": row[0], "WORK_DATE": row[1], "RUN_TIME": row[2], "NG_QTY": row[3] or 0}
            for row in rows
        ]
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
        cursor.close()
        connection.close()

# Route API để lấy danh sách options
@app.route('/getOptions', methods=['GET'])
def get_options():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Truy vấn dữ liệu từ bảng
        cursor.execute("SELECT machine_no, factory FROM cnt_machine_info")
        rows = cursor.fetchall()  # Lấy tất cả dữ liệu từ truy vấn

        # Chuyển đổi dữ liệu thành danh sách dictionary
        options = [{"machine_no": row[0], "factory": row[1]} for row in rows]
        connection.close()

        # Trả về dữ liệu dưới dạng JSON
        return jsonify(options)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/tasks/<string:MACHINE_NO>', methods=['DELETE'])
def delete_task(MACHINE_NO):
    connection = get_db_connection()
    cursor = connection.cursor()
    if MACHINE_NO == "null" or MACHINE_NO.strip() == "":
        MACHINE_NO = None
        jsonify({"error": "Machine_no không tồn tại"}), 400
    cursor.execute(
        "DELETE FROM CNT_MACHINE_SUMMARY WHERE MACHINE_NO = :machine_no OR (:machine_no IS NULL AND MACHINE_NO IS NULL)", 
        {"machine_no": MACHINE_NO}  
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
@app.route('/chartData2')
def chart_data2():
    # Kết nối tới cơ sở dữ liệu
    connection = get_db_connection()
    cursor = connection.cursor()
    # Câu lệnh SQL lấy dữ liệu từ bảng CNT_MACHINE_SUMMARY
    sql = """
        SELECT WORK_DATE, RUN_TIME, ERROR_TIME
        FROM CNT_MACHINE_SUMMARY
        ORDER BY WORK_DATE DESC
    """
    cursor.execute(sql)
    result = cursor.fetchall()
    
    # Tạo danh sách labels và data
    labels = [str(row[0]) for row in result] 
    runTime = [row[1] for row in result]
    errorTime = [row[2] for row in result] 

    # Cấu trúc dữ liệu trả về
    data = {
        "labels": labels,
        "datasets": [
            {
                "label": "RUN TIME",
                "data": runTime,
                "borderColor": "rgb(54, 162, 235)",
                "fill": False
            },
            {
                "label": "ERROR TIME",
                "data": errorTime,
                "borderColor": "rgb(255, 99, 132)",
                "fill": False
            }
        ]
    }
    cursor.close()
    connection.close()
    return jsonify(data)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Trang tải lên file
@app.route('/')
def upload_page():
    return render_template('upload.html')
# Xử lý file tải lên
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return "No file part"
    
    file = request.files['file']
    if file.filename == '':
        return "No selected file"
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)  # Bảo mật tên file
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)  # Lưu file

        # Phân loại và xử lý theo loại tệp
        file_extension = filename.rsplit('.', 1)[1].lower()
        if file_extension in {'jpg', 'jpeg', 'png'}:
            return render_template('view_image.html', filename=filename)
        elif file_extension in {'xlsx', 'xls'}:
            # Đọc nội dung Excel
            data = pd.read_excel(filepath)
            return render_template('view_excel.html', tables=[data.to_html(classes='data', header=True)], filename=filename)
    else:
        return "File not allowed"

# Route để hiển thị hình ảnh
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/downloadExcel')
def download_excel():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            SELECT LINE, NAME_MACHINE, FORCE_1, FORCE_2, FORCE_3, FORCE_4, STATE, TIME_UPDATE
            FROM SCREW_FORCE_INFO
            ORDER BY TIME_UPDATE DESC
        """
        cursor.execute(query)
        result = cursor.fetchall()
        cursor.close()
        connection.close()
        df = pd.DataFrame(result, columns=[
            'LINE', 'NAME_MACHINE', 'FORCE_1', 'FORCE_2', 
            'FORCE_3', 'FORCE_4', 'STATE', 'TIME_UPDATE'
        ])
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'dataScrewForce_{timestamp}.xlsx'
        # Tạo file Excel trong bộ nhớ

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Dữ liệu lực vít')
            workbook = writer.book
            worksheet = writer.sheets['Dữ liệu lực vít']
        
            header_format = workbook.add_format({
                'bold': True,
                'font_size': 12,
                'bg_color': '#D3D3D3'
            })
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            for column in df:
                column_length = max(df[column].astype(str).apply(len).max(), len(column))
                col_idx = df.columns.get_loc(column)
                worksheet.set_column(col_idx, col_idx, column_length + 2)
        output.seek(0)

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        app.logger.error(f"Lỗi tải xuống Excel: {str(e)}")
        flash("Đã xảy ra lỗi khi tạo file Excel. Vui lòng thử lại sau.", "error")
        return redirect(url_for('dashboard'))

if __name__=='__main__':
    app.run(debug=True)

