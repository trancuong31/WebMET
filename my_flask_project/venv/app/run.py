from flask import Flask, request, jsonify, abort, render_template, redirect, flash, send_file, make_response, url_for
import oracledb
from flask_cors import CORS
import jwt
from flask_socketio import SocketIO
import io
from datetime import datetime, timezone, timedelta
import pandas as pd
app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'
socketio =SocketIO(app)
DB_CONFIG = {
    "username": "system",
    "password": "123456",
    "dsn": "localhost:1521/orcl3"
}
CORS(app)
#kết nối Oracle
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

# redirect page adminDashboard
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

#redirect page index
@app.route('/index', methods=['GET'])
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
    return render_template('index.html', username=username)

# redirect page dashboard
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

# Hàm lấy dữ liệu với phân trang
def get_paginated_data(page, per_page):
    offset = (page - 1) * per_page
    offset = (page - 1) * per_page 
    query = """
        SELECT 
            ROWNUM as stt,
            t.factory,
            t.line, 
            t.name_machine, 
            t.model_name,
            t.serial_number,
            t.force_1, 
            t.force_2, 
            t.force_3, 
            t.force_4,
            t.time_update,
            t.state            
        FROM (
            SELECT 
                factory,
                line, 
                name_machine, 
                model_name,
                serial_number,
                force_1,
                force_2,
                force_3,
                force_4,
                TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update,
                state
            FROM SCREW_FORCE_INFO 
            ORDER BY TIME_UPDATE DESC
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        ) t
    """
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(query, {"offset": offset, "limit": per_page})
    rows = [
        {
            'stt': row[0],
            'factory': row[1],
            'line': row[2],
            'name_machine': row[3], 
            'model_name': row[4], 
            'serial_number': row[5],
            'force_1': row[6],
            'force_2': row[7],
            'force_3': row[8],
            'force_4': row[9],
            'time_update': row[10],
            'state': row[11]
        }
        for row in cursor
    ]    
    cursor.close()
    connection.close()
    return rows

# Hàm lấy tổng số bản ghi trong bảng
def get_total_records():
    query = "SELECT COUNT(*) FROM SCREW_FORCE_INFO"
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(query)
    total_records = cursor.fetchone()[0]
    cursor.close()
    connection.close()
    return total_records

# Hàm xử lý phân trang
def calculate_pagination(page, per_page, total_records):
    total_pages = (total_records + per_page - 1) // per_page
    if page < 1:
        page = 1
    elif page > total_pages:
        page = total_pages

    group_size = 5
    group_start = ((page - 1) // group_size) * group_size + 1
    group_end = min(group_start + group_size - 1, total_pages)
    
    return {
        "page": page,
        "total_pages": total_pages,
        "group_start": group_start,
        "group_end": group_end
    }

# return pie_chart_data
def get_pie_chart_data(start_date=None, end_date=None):
    query = """
        WITH FilteredData AS (
            SELECT * FROM SCREW_FORCE_INFO WHERE 1=1
    """
    params = {}
    if start_date:
        query += " AND TIME_UPDATE >= TO_DATE(:start_date, 'YYYY-MM-DD HH24:MI:SS')"
        params["start_date"] = start_date.strftime("%Y-%m-%d %H:%M:%S")
    if end_date:
        query += " AND TIME_UPDATE <= TO_DATE(:end_date, 'YYYY-MM-DD HH24:MI:SS')"
        params["end_date"] = end_date.strftime("%Y-%m-%d %H:%M:%S")

    query += """
        ),
        TotalStats AS (
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN STATE = 'PASS' THEN 1 ELSE 0 END) AS output,
                SUM(CASE WHEN STATE = 'FAIL' THEN 1 ELSE 0 END) AS fail
            FROM FilteredData
        ),
        PassStats AS (
            SELECT
                MODEL_NAME,
                COUNT(*) AS count,
                COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS percentage
            FROM FilteredData
            WHERE STATE = 'PASS'
            GROUP BY MODEL_NAME
        ),
        FailStats AS (
            SELECT
                MODEL_NAME,
                COUNT(*) AS count,
                COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS percentage
            FROM FilteredData
            WHERE STATE = 'FAIL'
            GROUP BY MODEL_NAME
        )
        SELECT
            ts.total,
            ts.output,
            ts.fail,
            'PASS' AS STATE,
            ps.MODEL_NAME,
            ps.count,
            ps.percentage
        FROM TotalStats ts
        LEFT JOIN PassStats ps ON 1=1
        UNION ALL
        SELECT
            ts.total,
            ts.output,
            ts.fail,
            'FAIL' AS STATE,
            fs.MODEL_NAME,
            fs.count,
            fs.percentage
        FROM TotalStats ts
        LEFT JOIN FailStats fs ON 1=1
    """

    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(query, params)

    result = cursor.fetchall()
    pie_chart_data = {
        "total": 0,
        "output": 0,
        "fail": 0,
        "fpyPass": 0,
        "fpyFail": 0,
        "details": []
    }

    for row in result:
        pie_chart_data["total"] = row[0]
        pie_chart_data["output"] = row[1]
        pie_chart_data["fail"] = row[2]
        pie_chart_data["fpyPass"] = (pie_chart_data["output"] / pie_chart_data["total"]) * 100 if pie_chart_data["total"] > 0 else 0
        pie_chart_data["fpyFail"] = (pie_chart_data["fail"] / pie_chart_data["total"]) * 100 if pie_chart_data["total"] > 0 else 0

        pie_chart_data["details"].append({
            "state": row[3], 
            "model_name": row[4] if row[4] else "Unknown", 
            "count": row[5] if row[5] is not None else 0,
            "percentage": row[6] if row[6] is not None else 0
        })

    cursor.close()
    connection.close()
    return pie_chart_data

# return column_chart_data
def get_column_chart_data(start_date=None, end_date=None):
    connection = get_db_connection()
    cursor = connection.cursor()
    if not start_date or not end_date:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=4)
    query = """
        WITH FilteredData AS (
            SELECT
                TO_CHAR(TIME_UPDATE, 'YYYY-MM-DD') AS report_date,
                NAME_MACHINE,
                TO_CHAR(TIME_UPDATE, 'HH24') AS report_hour,
                COUNT(*) AS fail_count
            FROM SCREW_FORCE_INFO
            WHERE STATE = 'FAIL'
                AND TIME_UPDATE BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD HH24:MI:SS')
                AND TO_DATE(:end_date, 'YYYY-MM-DD HH24:MI:SS')
            GROUP BY TO_CHAR(TIME_UPDATE, 'YYYY-MM-DD'), NAME_MACHINE, TO_CHAR(TIME_UPDATE, 'HH24')
        ),
        TopMachines AS (
            SELECT
                report_date,
                NAME_MACHINE,
                SUM(fail_count) AS total_fail,
                ROW_NUMBER() OVER (PARTITION BY report_date ORDER BY SUM(fail_count) DESC) AS rn
            FROM FilteredData
            GROUP BY report_date, NAME_MACHINE
        )
        SELECT 
            fd.report_date,
            rm.NAME_MACHINE,
            rm.total_fail,
            fd.report_hour,
            fd.fail_count
        FROM TopMachines rm
        JOIN FilteredData fd
            ON rm.report_date = fd.report_date 
            AND rm.NAME_MACHINE = fd.NAME_MACHINE
        WHERE rm.rn <= 3
        ORDER BY fd.report_date DESC, rm.total_fail DESC, fd.report_hour ASC
    """
    params = {
        "start_date": start_date.strftime("%Y-%m-%d 00:00:00"),
        "end_date": end_date.strftime("%Y-%m-%d 23:59:59")
    }
    cursor.execute(query, params)
    raw_data = cursor.fetchall()
    cursor.close()
    connection.close()
    column_chart_data = []
    date_dict = {}
    all_dates = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range((end_date - start_date).days + 1)]
    for row in raw_data:
        date, machine, total_fail, hour, fail_count = row

        if date not in date_dict:
            date_dict[date] = {}
        if machine not in date_dict[date]:
            date_dict[date][machine] = {
                "name": machine,
                "fail_count": total_fail,
                "hourly_data": []
            }
        date_dict[date][machine]["hourly_data"].append({
            "hour": hour,
            "fail_count": fail_count
        })
    for date in all_dates:
        if date not in date_dict:
            date_dict[date] = {}
    for date, machines in date_dict.items():
        column_chart_data.append({
            "date": date,
            "machines": list(machines.values())
        })

    return column_chart_data

#return column2_chart_data
def get_column2_chart_data(start_date=None, end_date=None):
    connection = get_db_connection()
    cursor = connection.cursor()
    if not start_date or not end_date:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=4)
    # Câu truy vấn SQL
    query = """
        SELECT TO_CHAR(TIME_UPDATE, 'YYYY-MM-DD') AS report_date,
               COUNT(CASE WHEN STATE = 'PASS' THEN 1 END) AS count_pass,
               COUNT(CASE WHEN STATE = 'FAIL' THEN 1 END) AS count_fail,
               ROUND((COUNT(CASE WHEN STATE = 'PASS' THEN 1 END) / COUNT(*)) * 100, 2) AS fpy
        FROM SCREW_FORCE_INFO
        WHERE TIME_UPDATE BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD HH24:MI:SS')
                              AND TO_DATE(:end_date, 'YYYY-MM-DD HH24:MI:SS')
        GROUP BY TO_CHAR(TIME_UPDATE, 'YYYY-MM-DD')
        ORDER BY report_date DESC
    """
    params = {
        "start_date": start_date.strftime("%Y-%m-%d 00:00:00"),
        "end_date": end_date.strftime("%Y-%m-%d 23:59:59")
    }
    cursor.execute(query, params)
    raw_data = cursor.fetchall()

    # Đóng kết nối
    cursor.close()
    connection.close()

    # Xử lý dữ liệu trả về
    fpy_chart_data = []
    all_dates = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range((end_date - start_date).days + 1)]
    date_dict = {date: {"date": date, "count_pass": 0, "count_fail": 0, "fpy": 0} for date in all_dates}
    for row in raw_data:
        date, count_pass, count_fail, fpy = row
        date_dict[date] = {
            "date": date,
            "count_pass": count_pass,
            "count_fail": count_fail,
            "fpy": fpy
        }
    fpy_chart_data = list(date_dict.values())
    return fpy_chart_data
# Dashboard
# @app.route('/dashboard', methods=['GET'])
# def dashboard():
#     try:
#         page = request.args.get('page', 1, type=int)
#         per_page = 10
#         rows = get_paginated_data(page, per_page)
#         total_records = get_total_records()
#         pagination_data = calculate_pagination(page, per_page, total_records)
#         pie_chart_data = get_pie_chart_data()

#         return jsonify({
#             "data": rows,
#             "per_page": per_page,
#             "total_records": total_records,
#             **pagination_data, 
#             "pie_chart_data": pie_chart_data
#         })
#     except Exception as e:
#         app.logger.error(f"Error querying data: {str(e)}")
#         return render_template('dashboard.html', error=str(e))

# get data table
@app.route('/api/dashboard/table', methods=['GET'])
def get_table():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        rows = get_paginated_data(page, per_page)
        total_records = get_total_records()
        pagination_data = calculate_pagination(page, per_page, total_records)

        return jsonify({
            "data": rows,
            "per_page": per_page,
            "total_records": total_records,
            **pagination_data
        })
    except Exception as e:
        app.logger.error(f"Error querying table data: {str(e)}")
        return jsonify({"error": str(e)}), 500

#get data All charts
@app.route('/api/dashboard/charts', methods=['GET'])
def get_charts():
    try:
        pie_chart_data = get_pie_chart_data()
        column_chart_data = get_column_chart_data()
        column2_chart_data = get_column2_chart_data()
        return jsonify({
            "pie_chart_data": pie_chart_data,
            "column_chart_data": column_chart_data,
            "column2_chart_data": column2_chart_data
        })
    except Exception as e:
        app.logger.error(f"Error querying chart data: {str(e)}")
        return jsonify({"error": str(e)}), 500

#get data table by filter
@app.route('/filter', methods=['POST'])
def filter_data():
    try:
        data = request.json
        line = data.get('line') if data.get('line') != "" else None
        factory = data.get('factory') if data.get('factory') != "" else None
        nameMachine = data.get('nameMachine') if data.get('nameMachine') != "" else None
        model = data.get('model') if data.get('model') != "" else None
        time_update = data.get('time_update') if data.get('time_update') != "" else None
        time_end = data.get('time_end') if data.get('time_end') != "" else None
        state = data.get('state') if data.get('state') != "" else None
        page = data.get('page', 1)
        per_page = data.get('per_page', 10)
        offset = (page - 1) * per_page
        connection = get_db_connection()
        cursor = connection.cursor()
        base_query = """
            SELECT factory,
                    line,
                    name_machine, 
                    model_name,
                    serial_number,
                    force_1,
                    force_2,
                    force_3,
                    force_4, 
                   TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update, 
                   state
            FROM Screw_force_info
            WHERE 1=1
        """
        count_query = "SELECT COUNT(*) FROM Screw_force_info WHERE 1=1"
        params = {}        
        # Xử lý điều kiện lọc
        if line:
            base_query += " AND UPPER(line) = UPPER(:line)"
            count_query += " AND UPPER(line) = UPPER(:line)"
            params['line'] = line
        if factory:
            base_query += " AND UPPER(factory) = UPPER(:factory)"
            count_query += " AND UPPER(factory) = UPPER(:factory)"
            params['factory'] = factory
        if model:
            base_query += " AND UPPER(model_name) = UPPER(:model_name)"
            count_query += " AND UPPER(model_name) = UPPER(:model_name)"
            params['MODEL_NAME'] = model
        if nameMachine:
            base_query += " AND UPPER(NAME_MACHINE) = UPPER(:NAME_MACHINE)"
            count_query += " AND UPPER(NAME_MACHINE) = UPPER(:NAME_MACHINE)"
            params['NAME_MACHINE'] = nameMachine
        if time_update and time_end:
            base_query += """
                AND time_update BETWEEN TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS') 
                                    AND TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')
            """
            count_query += """
                AND time_update BETWEEN TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS') 
                                    AND TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')
            """
            params['time_update'] = time_update
            params['time_end'] = time_end
        elif time_update:
            base_query += " AND time_update >= TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')"
            count_query += " AND time_update >= TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')"
            params['time_update'] = time_update
        elif time_end:
            base_query += " AND time_update <= TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')"
            count_query += " AND time_update <= TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')"
            params['time_end'] = time_end
        if state:
            base_query += " AND UPPER(state) = UPPER(:state)"
            count_query += " AND UPPER(state) = UPPER(:state)"
            params['state'] = state

        base_query += f" ORDER BY time_update DESC OFFSET {offset} ROWS FETCH NEXT {per_page} ROWS ONLY"

        # Thực thi query dữ liệu
        cursor.execute(base_query, params)
        results = []
        stt = offset + 1
        for row in cursor:
            results.append({
                'stt': stt,  
                'factory': row[0],
                'line': row[1],
                'name_machine': row[2],
                'model_name': row[3],
                'serial_number': row[4],
                'force_1': row[5],
                'force_2': row[6],
                'force_3': row[7],
                'force_4': row[8],
                'time_update': row[9],
                'state': row[10]
            })
            stt += 1

        cursor.execute(count_query, params)
        total_records = cursor.fetchone()[0]
        total_pages = (total_records + per_page - 1) // per_page

        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "data": results,
            "total_records": total_records,
            "total_pages": total_pages,
            "current_page": page,
            "per_page": per_page,
            "message": f"{total_records} result found"
        }), 200

    except Exception as e:
        app.logger.error(f"Lỗi khi truy vấn dữ liệu: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Đã có lỗi xảy ra khi truy vấn dữ liệu",
            "message": str(e)
        }), 500

# Filter pie chart
@app .route('/filterPieChart', methods=['POST'])
def filter_pie_chart():
    try:
        data = request.json
        time_update = data.get("time_update")
        time_end = data.get("time_end")
        if time_update and time_end:
            start_date = datetime.strptime(time_update, "%Y-%m-%d %H:%M:%S")
            end_date = datetime.strptime(time_end, "%Y-%m-%d %H:%M:%S")
        else:
            end_date = datetime.datetime.now()
            start_date = end_date - datetime.timedelta(days=7)
        pie_chart_date = get_pie_chart_data(start_date, end_date)
        return jsonify({"success": True, "pie_chart_date":pie_chart_date})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

# Filter column chart
@app .route('/filterColumnChart', methods=['POST'])
def filter_column_chart():
    try:
        data = request.json
        time_update = data.get("time_update")
        time_end = data.get("time_end")
        if time_update and time_end:
            start_date = datetime.strptime(time_update, "%Y-%m-%d %H:%M:%S")
            end_date = datetime.strptime(time_end, "%Y-%m-%d %H:%M:%S")
        column_chart_date = get_column_chart_data(start_date, end_date)
        return jsonify({"success": True, "column_chart_date":column_chart_date})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app .route('/filterColumn2Chart', methods=['POST'])
def filter_column2_chart():
    try:
        data = request.json
        time_update = data.get("time_update")
        time_end = data.get("time_end")
        if time_update and time_end:
            start_date = datetime.strptime(time_update, "%Y-%m-%d %H:%M:%S")
            end_date = datetime.strptime(time_end, "%Y-%m-%d %H:%M:%S")
        column2_chart_date = get_column2_chart_data(start_date, end_date)
        return jsonify({"success": True, "column2_chart_date":column2_chart_date})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

#logout
@app.route('/logout', methods=['GET'])
def logout():
    resp = make_response(redirect(('login')))
    resp.delete_cookie('token')
    return resp

# login
@app.route('/login', methods=['POST', 'GET'])
def login():
    if request.method == 'POST':
        username = request.form.get('username').strip()

        password = request.form.get('password').strip()
        try:
            # Kết nối CSDL
            connection = get_db_connection()
            cursor = connection.cursor()
            query = """
                SELECT PASSWORD, ROLE 
                FROM USERS 
                WHERE USERNAME = :username
            """
            cursor.execute(query, {"username": username})
            row = cursor.fetchone()
            if row and password== row[0]:
                role = row[1]
                access_token = jwt.encode({
                    'username': username,
                    'role': role,
                    'exp': datetime.now(timezone.utc) + timedelta(hours=2),
                    'type': 'access'
                }, app.config['SECRET_KEY'], algorithm='HS256')
                refresh_token = jwt.encode({
                    'username': username,
                    'role': role,
                    'exp': datetime.now(timezone.utc) + timedelta(days=7),
                    'type': 'refresh'
                }, app.config['SECRET_KEY'], algorithm='HS256')
                resp = make_response(redirect('/adminDashboard' if role == 'admin' else '/index'))
                # Thiết lập cookie an toàn
                resp.set_cookie('token', access_token, httponly=True, secure=True, max_age=60*60, samesite='Strict')
                resp.set_cookie('refresh_token', refresh_token, httponly=True, secure=True, max_age=7*24*60*60, samesite='Strict')                
                return resp
            else:
                return render_template('login.html', error='Incorrect username or password')
        except Exception as e:
            error_message = str(e)
            return render_template('login.html', error=f"{error_message} Please check backend.")
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

#register
@app.route('/register', methods=['GET', 'POST'])
def register():
    try:
        if request.method == 'POST':
            username = request.form.get('username')
            password = request.form.get('password')
            email = request.form.get('email')
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
        error_message = f"Database error: {e}"
        print(error_message) 
        return render_template('register.html', error=f"An error occurred: {e}")

#get data combobox
@app.route('/getDataComboboxs', methods=['GET'])
def get_lines():
    try:
        query = """
            SELECT 'Line', Line FROM SCREW_FORCE_INFO WHERE LINE IS NOT NULL
            UNION
            SELECT 'State', State FROM SCREW_FORCE_INFO WHERE STATE IS NOT NULL
            UNION
            SELECT 'NameMachine', NAME_MACHINE FROM SCREW_FORCE_INFO WHERE NAME_MACHINE IS NOT NULL
            UNION
            SELECT 'Factory', FACTORY FROM SCREW_FORCE_INFO WHERE FACTORY IS NOT NULL
            UNION
            SELECT 'ModelName', MODEL_NAME FROM SCREW_FORCE_INFO WHERE MODEL_NAME IS NOT NULL
        """
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
        result = {"lines": [], "states": [], "nameMachines": [], "factories": [], "modelNames": []}
        for category, value in rows:
            if category == 'Line':
                result["lines"].append(value)
            elif category == 'State':
                result["states"].append(value)
            elif category == 'NameMachine':
                result["nameMachines"].append(value)
            elif category == 'Factory':
                result["factories"].append(value)
            elif category == 'ModelName':
                result["modelNames"].append(value)
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching: {e}")
        return jsonify({"error": "Unable to fetch"}), 500

#get total , output, fpy
@app.route('/getinfo', methods=['GET'])
def getinfo():
    try:
        query = """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN STATE = 'PASS' THEN 1 ELSE 0 END) AS output,
                SUM(CASE WHEN STATE = 'FAIL' THEN 1 ELSE 0 END) AS fail
            FROM SCREW_FORCE_INFO
        """
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                result = cursor.fetchone()
        
        total, output, fail = result
        fpy = (output / total) * 100 if total > 0 else 0 
        
        return jsonify({
            "total": total,
            "output": output,
            "fail": fail,
            "fpy": fpy
        })
    except Exception as e:
        app.logger.error(f"Error querying data: {str(e)}")
        return jsonify({
            "error": "Error querying data",
            "message": str(e)
        }), 500

#get data table by filter
def fetch_filtered_data(filters):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            SELECT line, factory, name_machine, model_name, serial_number,
                   force_1, force_2, force_3, force_4, 
                   TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update, 
                   state
            FROM Screw_force_info
            WHERE 1=1
        """
        params = {}
        if filters.get('line'):
            query += " AND UPPER(line) = UPPER(:line)"
            params['line'] = filters['line']
        if filters.get('factory'):
            query += " AND UPPER(factory) = UPPER(:factory)"
            params['factory'] = filters['factory']
        if filters.get('model'):
            query += " AND UPPER(MODEL_NAME) = UPPER(:model)"
            params['model'] = filters['model']
        if filters.get('nameMachine'):
            query += " AND UPPER(name_machine) = UPPER(:name_machine)"
            params['name_machine'] = filters['nameMachine']
        if filters.get('time_update') and filters.get('time_end'):
            query += """
                AND time_update BETWEEN TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')
                                    AND TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')
            """
            params['time_update'] = filters['time_update']
            params['time_end'] = filters['time_end']
        elif filters.get('time_update'):
            query += " AND time_update >= TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')"
            params['time_update'] = filters['time_update']
        elif filters.get('time_end'):
            query += " AND time_update <= TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')"
            params['time_end'] = filters['time_end']
        if filters.get('state'):
            query += " AND UPPER(state) = UPPER(:state)"
            params['state'] = filters['state']

        query += " ORDER BY time_update DESC"

        # Thực thi query
        cursor.execute(query, params)
        result = cursor.fetchall()
        cursor.close()
        connection.close()

        return result
    except Exception as e:
        app.logger.error(f"Lỗi khi truy vấn dữ liệu: {str(e)}")
        raise

#download excel
@app.route('/downloadExcel', methods=['POST'])
def download_excel():
    try:
        filters = request.json
        result = fetch_filtered_data(filters)
        df = pd.DataFrame(result, columns=[
            'LINE','FACTORY', 'NAME_MACHINE','MODEL_NAME','SERIAL_NUMBER', 'FORCE_1', 'FORCE_2',
            'FORCE_3', 'FORCE_4', 'TIME_UPDATE', 'STATE'
        ])
        df = df.fillna("N/A")
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
        app.logger.error(f"Error download file Excel: {str(e)}")
        flash("Đã xảy ra lỗi khi tạo file Excel. Vui lòng thử lại sau.", "error")
        return redirect(url_for('dashboard_page'))

if __name__=='__main__':
    app.run(debug=True, threaded = True)


