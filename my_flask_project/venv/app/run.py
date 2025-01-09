from flask import Flask, request, jsonify, abort, render_template, redirect, flash, send_file, make_response, url_for, send_from_directory
import oracledb
from flask_cors import CORS
import jwt
import os, io
from datetime import datetime, timezone, timedelta
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
# @app.route('/configForm', methods=['GET'])
# def show_form():
#     token = request.cookies.get('token')
#     if not token:
#         return redirect(('login'))
#     try:
#         data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
#         username = data['username']
#     except jwt.ExpiredSignatureError:
#         flash('Token has expired, please log in again.', 'error')
#         return redirect(('login'))
#     except jwt.InvalidTokenError:
#         flash('Invalid token, please log in again.', 'error')
#         return redirect(('login'))
#     return render_template('index.html', username=username)
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
    return render_template('index1.html', username=username)
@app.route('/dashboard_page', methods=['GET'])
def dashboard_page():
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
    return render_template('dashboard.html', username=username)

@app.route('/dashboard', methods=['GET'])
def dashboard():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10 
        offset = (page - 1) * per_page 
        # # Lấy tham số lọc
        # data = request.json
        # line = data.get('line') if data.get('line') != "" else None
        # time_update = data.get('time_update') if data.get('time_update') != "" else None
        # state = data.get('state') if data.get('state') != "" else None
        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            SELECT 
                ROWNUM as stt,
                t.line, 
                t.name_machine, 
                t.force_1, 
                t.force_2, 
                t.force_3, 
                t.force_4,
                t.time_update,
                t.state
            FROM (
                SELECT 
                    line, 
                    name_machine, 
                    force_1, 
                    force_2, 
                    force_3, 
                    force_4,
                    TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update,
                    state
                FROM SCREW_FORCE_INFO 
                OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
            ) t
        """
        
        cursor.execute(query, {"offset": offset, "limit": per_page})
        rows = []
        for row in cursor:
            rows.append({
                'stt': row[0],
                'line': row[1],
                'name_machine': row[2],
                'force_1': row[3],
                'force_2': row[4], 
                'force_3': row[5],
                'force_4': row[6],
                'time_update': row[7],
                'state': row[8]
            })

        # Tính tổng số trang
        cursor.execute("SELECT COUNT(*) FROM SCREW_FORCE_INFO")
        total_records = cursor.fetchone()[0]
        total_pages = (total_records + per_page - 1) // per_page 
        group_size = 5
        if page<0 :
            page = 1
        elif page > total_pages:
            page = total_pages
        group_start = ((page - 1) // group_size) * group_size + 1
        group_end = min(group_start + group_size - 1, total_pages)

        return jsonify({
            "data": rows,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "total_records": total_records,
            "group_start": group_start,
            "group_end": group_end
        })
    except Exception as e:
        app.logger.error(f"Error querying data: {str(e)}")
        return render_template('dashboard.html', error=str(e))
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/logout', methods=['GET'])
def logout():
    resp = make_response(redirect(('login')))
    resp.delete_cookie('token')
    return resp
@app.route('/login', methods=['POST', 'GET'])
def login():
    if request.method == 'POST':
        username = request.form.get('username').strip()
        password = request.form.get('password').strip()

        try:
            # Kết nối tới cơ sở dữ liệu
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
                # Tạo JWT token
                access_token = jwt.encode({
                    'username': username,
                    'exp': datetime.now(timezone.utc) + timedelta(hours=1),  # Token hết hạn sau 1 giờ
                    'type': 'access'
                }, app.config['SECRET_KEY'], algorithm='HS256')

                refresh_token = jwt.encode({
                    'username': username,
                    'exp': datetime.now(timezone.utc) + timedelta(days=7),  # Refresh token hết hạn sau 7 ngày
                    'type': 'refresh'
                }, app.config['SECRET_KEY'], algorithm='HS256')
                resp = make_response(redirect(('index1')))
                # Trả về JSON chứa các token
                resp.set_cookie('token', access_token, httponly=True, secure=True, max_age=60*60) #1h
                resp.set_cookie('refresh_token', refresh_token, httponly=True, secure=True, max_age=7*24*60*60) #7 days 
                return resp
            else:
                return render_template('login.html', error='Incorrect username or password')

        except Exception as e:
            return jsonify({'error': f'Database error: {e}'}), 500 

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

@app.route('/filter', methods=['POST'])
def filter_data():
    try:
        data = request.json
        line = data.get('line') if data.get('line') != "" else None
        time_update = data.get('time_update') if data.get('time_update') != "" else None
        time_end = data.get('time_end') if data.get('time_end') != "" else None
        state = data.get('state') if data.get('state') != "" else None
        connection = get_db_connection()
        cursor = connection.cursor()

        base_query = """
            SELECT line, name_machine, force_1, force_2, force_3, force_4, TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update, 
                   state
            FROM Screw_force_info
            WHERE 1=1
        """
        params = {}
        # Xử lý điều kiện cho line
        if line is not None:
            base_query += " AND UPPER(line) = UPPER(:line)"
            params['line'] = line
        if time_update and time_end:
            base_query += " AND time_update BETWEEN TO_DATE(:time_update, 'YYYY-MM-DD') AND TO_DATE(:time_end, 'YYYY-MM-DD') + 1"
            params['time_update'] = time_update
            params['time_end'] = time_end
        elif time_update and time_end is None:
            base_query += " AND time_update >= TO_DATE(:time_update, 'YYYY-MM-DD')"
            params['time_update'] = time_update
        elif time_end and time_update is None:
            base_query += " AND time_update <= TO_DATE(:time_end, 'YYYY-MM-DD') + 1"
            params['time_end'] = time_end

        # Xử lý điều kiện cho state
        if state is not None:
            base_query += " AND UPPER(state) = UPPER(:state)"
            params['state'] = state
        base_query += """ 
            ORDER BY time_update DESC
            FETCH FIRST 1000 ROWS ONLY
        """
        cursor.execute(base_query, params)

        # Lấy kết quả
        results = []
        stt=1
        for row in cursor:
            results.append({
                "stt": stt,
                "line": row[0],
                "name_machine": row[1],
                "force_1": row[2],
                "force_2": row[3],
                "force_3": row[4],
                "force_4": row[5],
                "time_update": row[6],
                "state": row[7]
            })
            stt+=1
        cursor.close()
        connection.close()
        applied_filters = {
            "line": line,
            "date": time_update,
            "state": state
        }
        
        return jsonify({
            "success": True,
            "data": results,
            "count": len(results),
            "applied_filters": applied_filters,
            "message": f"Đã tìm thấy {len(results)} kết quả"
        }), 200

    except Exception as e:
        # Log lỗi
        app.logger.error(f"Lỗi khi truy vấn dữ liệu: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Đã có lỗi xảy ra khi truy vấn dữ liệu",
            "message": str(e)
        }), 500



if __name__=='__main__':
    app.run(debug=True)

