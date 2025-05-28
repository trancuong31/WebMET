from flask import Flask, request, jsonify, abort, render_template, redirect, flash, send_file, make_response, url_for
import oracledb
from flask_cors import CORS
import jwt
import io
from datetime import datetime, timezone, timedelta
import pandas as pd
from flask_caching import Cache
from collections import defaultdict
from waitress import serve
from functools import wraps
# from app.routes import app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'
cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 300})
cache.init_app(app)
DB_CONFIG = {
    "username": "system",
    "password": "123456",
    "dsn": "localhost:1521/orcl3"
}
oracledb.init_oracle_client(lib_dir=r"D:\instantclient\instantclient_23_5")
CORS(app)
#kết nối Oracle
def get_db_connection():
    try:
        connection = oracledb.connect(
            # user="pthnew",
            # password="pthnew",
            # dsn="10.228.114.170:3333/meorcl"
            user= "system",
            password= "123456",
            dsn= "localhost:1521/orcl3"
        )
        return connection
    except oracledb.DatabaseError as e:
        print(f"Lỗi kết nối cơ sở dữ liệu: {e}")
        abort(500, description="Không thể kết nối cơ sở dữ liệu.")
@app.route('/', methods=['GET'])
def home():
    return render_template('index.html')
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

def require_auth(role_required=None):
    def wrapper(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = request.cookies.get('token')
            if not token:
                return jsonify({"error": "Unauthorized"}), 401
            try:
                data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                if role_required and data.get('role') != role_required:
                    return jsonify({"error": "Forbidden"}), 403
                request.user = data  # attach user info
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Token expired"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid token"}), 401
            return f(*args, **kwargs)
        return decorated
    return wrapper
#redirect page index
@app.route('/index', methods=['GET'])
def index1():
    token = request.cookies.get('token')
    app.logger.info(f"Index page accessed. Token exists: {bool(token)}")
    
    if not token:
        app.logger.warning("No token found, redirecting to login")
        return redirect(url_for('login'))
    
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        username = data['username']
        app.logger.info(f"Token decoded successfully for user: {username}")
        return render_template('index.html', username=username)
        
    except jwt.ExpiredSignatureError:
        app.logger.warning("Token expired")
        flash('Token has expired, please log in again.', 'error')
        return redirect(url_for('login'))
        
    except jwt.InvalidTokenError:
        app.logger.warning("Invalid token")
        flash('Invalid token, please log in again.', 'error')
        return redirect(url_for('login'))
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
@app.route('/dashboard_page_glue', methods=['GET'])
def dashboard_page_glue():
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
    return render_template('dashboardglue.html', username=username)

def get_paginated_data(page, per_page, type_machine):
    offset = (page - 1) * per_page
    if type_machine == 'Screw':
        query = """
        SELECT 
            ROWNUM as stt,
            factory,
            line, 
            name_machine, 
            model_name,
            serial_number,
            force_1, 
            force_2, 
            force_3,
            force_4,
            time_update,
            CASE
                WHEN 
                    (force_1 IS NOT NULL AND NOT (force_1 BETWEEN min_force AND max_force)) OR
                    (force_2 IS NOT NULL AND NOT (force_2 BETWEEN min_force AND max_force)) OR
                    (force_3 IS NOT NULL AND NOT (force_3 BETWEEN min_force AND max_force)) OR
                    (force_4 IS NOT NULL AND NOT (force_4 BETWEEN min_force AND max_force))
                THEN 'FAIL'
                ELSE 'PASS'
            END AS result
        FROM (
            SELECT 
                ROWNUM AS rn,
                t.*,
                d.min_force,
                d.max_force
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
                    TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update
                FROM SCREW_FORCE_INFO
                ORDER BY time_update DESC
            ) t
            LEFT JOIN force_default d
                ON t.line = d.line 
                AND t.name_machine = d.name_machine
            WHERE d.type_machine = 'Screw'
        ) t
        WHERE rn > :offset AND rn <= :offset + :limit
        """
    elif type_machine == 'Glue':
        query = """
        SELECT 
            ROWNUM as stt,
            factory,
            line, 
            name_machine, 
            model_name,
            serial_number,
            force_1, 
            force_2, 
            force_3,
            force_4,
            time_update,
            CASE
                WHEN 
                    (force_1 IS NOT NULL AND NOT (force_1 BETWEEN min_force AND max_force)) OR
                    (force_2 IS NOT NULL AND NOT (force_2 BETWEEN min_force AND max_force)) OR
                    (force_3 IS NOT NULL AND NOT (force_3 BETWEEN min_force AND max_force)) OR
                    (force_4 IS NOT NULL AND NOT (force_4 BETWEEN min_force AND max_force))
                THEN 'FAIL'
                ELSE 'PASS'
            END AS result
        FROM (
            SELECT 
                ROWNUM AS rn,
                t.*,
                d.min_force,
                d.max_force
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
                    TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update
                FROM GLUE_FORCE_INFO
                ORDER BY time_update DESC
            ) t
            LEFT JOIN force_default d
                ON t.line = d.line 
                AND t.name_machine = d.name_machine
            WHERE d.type_machine = 'Glue'
        ) t
        WHERE rn > :offset AND rn <= :offset + :limit
        """
    elif type_machine == 'Shielding':
        query = """
        SELECT 
            ROWNUM as stt,
            factory,
            line, 
            name_machine, 
            model_name,
            serial_number,
            force_1, 
            force_2, 
            force_3,
            force_4,
            time_update,
            CASE
                WHEN 
                    (force_1 IS NOT NULL AND NOT (force_1 BETWEEN min_force AND max_force)) OR
                    (force_2 IS NOT NULL AND NOT (force_2 BETWEEN min_force AND max_force)) OR
                    (force_3 IS NOT NULL AND NOT (force_3 BETWEEN min_force AND max_force)) OR
                    (force_4 IS NOT NULL AND NOT (force_4 BETWEEN min_force AND max_force))
                THEN 'FAIL'
                ELSE 'PASS'
            END AS result
        FROM (
            SELECT 
                ROWNUM AS rn,
                t.*,
                d.min_force,
                d.max_force
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
                    TO_CHAR(time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update
                FROM Shielding_COVER_FORCE_INFO
                ORDER BY time_update DESC
            ) t
            LEFT JOIN force_default d
                ON t.line = d.line 
                AND t.name_machine = d.name_machine
            WHERE d.type_machine = 'Shielding'
        ) t
        WHERE rn > :offset AND rn <= :offset + :limit
        """
    
    else:
        raise ValueError("Invalid type_machine. Must be 'Screw' or 'Glue' or 'Shielding'.")
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
            'result': row[11]
        }
        for row in cursor
    ]
    cursor.close()
    connection.close()
    return rows

# Hàm lấy tổng số bản ghi trong bảng
def get_total_records(type_machine):
    if type_machine == 'Screw':
        query = """SELECT COUNT(*) FROM SCREW_FORCE_INFO"""
    elif type_machine == 'Glue':
        query = """SELECT COUNT(*) FROM GLUE_FORCE_INFO"""
    elif type_machine == 'Shielding':
        query = """SELECT COUNT(*) FROM SHIELDING_COVER_FORCE_INFO"""
    else:
        raise ValueError("Invalid type_machine. Must be 'Screw' or 'Glue' or 'Shielding'.")
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
 
#return pie_chart_data
def get_pie_chart_data(type_machine, start_date=None, end_date=None, line=None, name_machine=None):
    if not start_date or not end_date:
        today = datetime.now()
        end_date = today.replace(hour=23, minute=59, second=59, microsecond=0)
        start_date = (end_date - timedelta(days=4)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    connection = get_db_connection()    
    cursor = connection.cursor()
    if type_machine == 'Screw':
        query = """
            SELECT 
                s.model_name,
                s.line,
                s.name_machine,
                s.force_1,
                s.force_2,
                s.force_3,
                s.force_4,
                d.min_force,
                d.max_force
            FROM screw_force_info s
            LEFT JOIN force_default d
            ON s.line = d.line AND s.name_machine = d.name_machine AND d.type_machine = 'Screw'
            WHERE s.time_update BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD HH24:MI:SS')
                                    AND TO_DATE(:end_date, 'YYYY-MM-DD HH24:MI:SS')
        """
    elif type_machine == 'Glue':
        query = """
            SELECT
                s.model_name,
                s.line,
                s.name_machine,
                s.force_1,
                s.force_2,
                s.force_3,
                s.force_4,
                d.min_force,
                d.max_force
            FROM glue_force_info s
            LEFT JOIN force_default d
            ON s.line = d.line AND s.name_machine = d.name_machine
            WHERE d.type_machine = 'Glue'
              AND s.time_update BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD HH24:MI:SS')
                                    AND TO_DATE(:end_date, 'YYYY-MM-DD HH24:MI:SS')
        """
    elif type_machine == 'Shielding':
        query = """
            SELECT
                s.model_name,
                s.line,
                s.name_machine,
                s.force_1,
                s.force_2,
                s.force_3,
                s.force_4,
                d.min_force,
                d.max_force
            FROM Shielding_cover_force_info s
            LEFT JOIN force_default d
            ON s.line = d.line AND s.name_machine = d.name_machine
            WHERE d.type_machine = 'Shielding'
              AND s.time_update BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD HH24:MI:SS')
                                    AND TO_DATE(:end_date, 'YYYY-MM-DD HH24:MI:SS')
        """
    else:
        raise ValueError("Invalid type_machine. Must be 'Screw', 'Glue', or 'Shielding'.")
    if line and name_machine:
        query += " AND s.line = :line AND s.name_machine = :name_machine"
    # Tham số truyền vào truy vấn
    params = {
        "start_date": start_date.strftime("%Y-%m-%d %H:%M:%S"),
        "end_date": end_date.strftime("%Y-%m-%d %H:%M:%S"),
        "line": line,
        "name_machine": name_machine
    }
    # Thực thi truy vấn
    cursor.execute(query, {k: v for k, v in params.items() if v is not None})
    rows = cursor.fetchall()

    # Xử lý dữ liệu
    model_stats = {
        "PASS": defaultdict(int),
        "FAIL": defaultdict(int)
    }
    total = 0
    pass_count = 0
    fail_count = 0

    for row in rows:
        model_name = row[0] or "Unknown"
        forces = [row[3], row[4], row[5], row[6]]
        min_force, max_force = row[7], row[8]

        def is_force_valid(f):
            return f is None or (min_force is not None and max_force is not None and min_force <= f <= max_force)

        state = "PASS" if all(is_force_valid(f) for f in forces) else "FAIL"

        model_stats[state][model_name] += 1
        total += 1
        if state == "PASS":
            pass_count += 1
        else:
            fail_count += 1

    # Chuẩn bị dữ liệu trả về
    pie_chart_data = {
        "total": total,
        "output": pass_count,
        "fail": fail_count,
        "fpyPass": (pass_count / total) * 100 if total else 0,
        "fpyFail": (fail_count / total) * 100 if total else 0,
        "details": []
    }

    for model, count in model_stats["PASS"].items():
        pie_chart_data["details"].append({
            "state": "PASS",
            "model_name": model,
            "count": count,
            "percentage": (count / pass_count) * 100 if pass_count else 0
        })

    for model, count in model_stats["FAIL"].items():
        pie_chart_data["details"].append({
            "state": "FAIL",
            "model_name": model,
            "count": count,
            "percentage": (count / fail_count) * 100 if fail_count else 0
        })

    cursor.close()
    connection.close()
    return pie_chart_data

# return column_chart_data
def get_column_chart_data(type_machine, start_date=None, end_date=None):
    connection = get_db_connection()
    cursor = connection.cursor()

    if not start_date or not end_date:
        today = datetime.now()
        end_date = today.replace(hour=23, minute=59, second=59, microsecond=0)
        start_date = (end_date - timedelta(days=4)).replace(hour=0, minute=0, second=0, microsecond=0)
        print("Start Date:", start_date)
        print("End Date:", end_date)
    params = {
        "start_date": start_date,
        "end_date": end_date
    }
    # Lấy ngưỡng lực
    cursor.execute("SELECT line, name_machine, min_force, max_force FROM force_default")
    force_limits = {
        (row[0].upper(), row[1].upper()): (row[2], row[3])
        for row in cursor.fetchall()
    }
    if type_machine == 'Screw':
        cursor.execute("""
            SELECT
                TO_CHAR(time_update, 'YYYY-MM-DD') AS report_date,
                name_machine,
                line, model_name, serial_number,
                force_1, force_2, force_3, force_4,
                TO_CHAR(time_update, 'HH24') AS report_hour,
                TO_CHAR(time_update, 'HH24:MI:SS') AS report_time   
            FROM screw_force_info
            WHERE time_update BETWEEN :start_date AND :end_date
        """, params)
    elif type_machine == 'Glue':
        cursor.execute("""
            SELECT
                TO_CHAR(time_update, 'YYYY-MM-DD') AS report_date,
                name_machine, 
                line,model_name, serial_number,
                force_1, force_2, force_3, force_4,
                TO_CHAR(time_update, 'HH24') AS report_hour,
                TO_CHAR(time_update, 'HH24:MI:SS') AS report_time
            FROM glue_force_info
            WHERE time_update BETWEEN :start_date AND :end_date
        """, params)
    elif type_machine == 'Shielding':
        cursor.execute("""
            SELECT
                TO_CHAR(time_update, 'YYYY-MM-DD') AS report_date,
                name_machine, 
                line,model_name, serial_number,
                force_1, force_2, force_3, force_4,
                TO_CHAR(time_update, 'HH24') AS report_hour,
                TO_CHAR(time_update, 'HH24:MI:SS') AS report_time
            FROM Shielding_COVER_FORCE_INFO
            WHERE time_update BETWEEN :start_date AND :end_date
        """, params)
    else:
        raise ValueError("Invalid type_machine. Must be 'Screw' or 'Glue' or 'Shielding'.")
    rows = cursor.fetchall()
    cursor.close()
    connection.close()

    machine_fail_map = defaultdict(lambda: defaultdict(lambda: {
        "fail_count": 0,
        "hourly_data": defaultdict(int),
        "details": []
    }))

    for row in rows:
        date, machine, line, model_name, serial_number = row[0], row[1], row[2], row[3], row[4]
        forces = [row[5], row[6], row[7], row[8]]
        hour = row[9]
        time = row[10]
        key = (line.upper() if line else "", machine.upper() if machine else "")
        min_force, max_force = force_limits.get(key, (None, None))

        def is_force_invalid(f):
            return f is not None and (min_force is None or max_force is None or not (min_force <= f <= max_force))

        if any(is_force_invalid(f) for f in forces):
            machine_fail_map[date][machine]["fail_count"] += 1
            machine_fail_map[date][machine]["hourly_data"][hour] += 1
            machine_fail_map[date][machine]["details"].append({
                "line": line,
                "machine": machine,
                "date": date,
                "model_name":model_name,
                "serial_number": serial_number,
                "hour": hour,
                "time": time,
                "force_1": forces[0],
                "force_2": forces[1],
                "force_3": forces[2],
                "force_4": forces[3],
                "min_force": min_force,
                "max_force": max_force,
            })

    get_column_chart_data = []
    all_dates = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d")
                 for i in range((end_date - start_date).days + 1)]

    for date in all_dates:
        daily_data = machine_fail_map.get(date, {})
        sorted_machines = sorted(daily_data.items(), key=lambda x: x[1]["fail_count"], reverse=True)[:3]

        machines = []
        for machine_name, stats in sorted_machines:
            hourly = [{"hour": hour, "fail_count": count}
                      for hour, count in sorted(stats["hourly_data"].items(), key=lambda x: int(x[0]))]
            machines.append({
                "name": machine_name,
                "fail_count": stats["fail_count"],
                "hourly_data": hourly,
                "details": stats["details"]
            })

        get_column_chart_data.append({
            "date": date,
            "machines": machines

        })
    return get_column_chart_data

#return column2_chart_data
def get_column2_chart_data(type_machine, start_date=None, end_date=None, line=None, name_machine=None):
    if not start_date or not end_date:
        today = datetime.now()
        end_date = today.replace(hour=23, minute=59, second=59, microsecond=0)
        start_date = (end_date - timedelta(days=4)).replace(hour=0, minute=0, second=0, microsecond=0)

    connection = get_db_connection()
    cursor = connection.cursor()

    # 1. Lấy ngưỡng min/max lực
    cursor.execute("SELECT line, name_machine, min_force, max_force FROM force_default")
    force_limits = {
        (row[0].upper(), row[1].upper()): (row[2], row[3])
        for row in cursor.fetchall()
    }

    # 2. Truy vấn dữ liệu theo loại máy
    params = {
        "start_date": start_date.strftime("%Y-%m-%d 00:00:00"),
        "end_date": end_date.strftime("%Y-%m-%d 23:59:59"),
        "line": line,
        "name_machine": name_machine
    }

    base_query = """
        SELECT
            TO_CHAR(s.time_update, 'YYYY-MM-DD') AS report_date,
            s.line,
            s.name_machine,
            s.force_1, s.force_2, s.force_3, s.force_4
        FROM {table_name} s
        WHERE s.time_update BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD HH24:MI:SS')
                                AND TO_DATE(:end_date, 'YYYY-MM-DD HH24:MI:SS')
    """
    if line and name_machine:
        base_query += " AND s.line = :line AND s.name_machine = :name_machine"

    if type_machine == 'Screw':
        final_query = base_query.format(table_name="screw_force_info")
    elif type_machine == 'Glue':
        final_query = base_query.format(table_name="glue_force_info")
    elif type_machine == 'Shielding':
        final_query = base_query.format(table_name="Shielding_cover_force_info")
    else:
        raise ValueError("Invalid type_machine. Must be 'Screw', 'Glue', or 'Shielding'.")

    cursor.execute(final_query, {k: v for k, v in params.items() if v is not None})
    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    # 3. Xử lý đếm pass/fail theo ngày
    result_by_date = defaultdict(lambda: {"count_pass": 0, "count_fail": 0})

    for row in rows:
        date, line, machine = row[0], row[1], row[2]
        forces = [row[3], row[4], row[5], row[6]]
        key = (line.upper() if line else "", machine.upper() if machine else "")
        min_force, max_force = force_limits.get(key, (None, None))

        def is_force_invalid(f):
            return f is not None and (min_force is None or max_force is None or not (min_force <= f <= max_force))

        state = "FAIL" if any(is_force_invalid(f) for f in forces) else "PASS"
        if state == "PASS":
            result_by_date[date]["count_pass"] += 1
        else:
            result_by_date[date]["count_fail"] += 1

    # 4. Chuẩn hóa dữ liệu cho từng ngày
    all_dates = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d")
                 for i in range((end_date - start_date).days + 1)]

    fpy_chart_data = []
    for date in all_dates:
        pass_count = result_by_date[date]["count_pass"]
        fail_count = result_by_date[date]["count_fail"]
        total = pass_count + fail_count
        fpy = round((pass_count / total) * 100, 2) if total > 0 else 0
        fpy_chart_data.append({
            "date": date,
            "count_pass": pass_count,
            "count_fail": fail_count,
            "fpy": fpy
        })

    return fpy_chart_data

# lấy ra lưỡng ngực dựa vào line và name_machine
def get_min_max_force(line, machine_name, type_machine):
    try:
        query = """
            SELECT MIN_FORCE, MAX_FORCE 
            FROM force_default
            WHERE LINE = :line AND NAME_MACHINE = :machine_name AND TYPE_MACHINE = :type_machine
        """
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                # Thêm tham số type_machine vào dictionary
                cursor.execute(query, {'line': line, 'machine_name': machine_name, 'type_machine': type_machine})
                result = cursor.fetchone()
                if result:
                    return {"min_force": result[0], "max_force": result[1]}
                else:
                    return {"min_force": None, "max_force": None}
    except Exception as e:
        print(f"Error fetching min/max force: {e}")
        return {"min_force": None, "max_force": None}
#get data Force chart
def get_data_force_chart(type_machine, machine_name=None, line=None):
    connection = get_db_connection()
    cursor = connection.cursor()    
    if type_machine == 'Screw':
        if machine_name is None and line is None:
            machine_name = 'Machine_3'
            line = 'Line_3'

        minmax = get_min_max_force(line=line, machine_name=machine_name, type_machine=type_machine)
        query = """
            SELECT * FROM (
                SELECT name_machine, force_1, force_2, force_3, force_4, time_update
                FROM screw_force_info
                WHERE name_machine = :machine_name AND line = :line
                ORDER BY time_update DESC
            )
            WHERE ROWNUM <= 30
        """
        cursor.execute(query, {"machine_name": machine_name, "line": line})
    elif type_machine == 'Glue':
        if machine_name is None and line is None:
            machine_name = 'DK02'
            line = 'T06'

        minmax = get_min_max_force(line=line, machine_name=machine_name, type_machine=type_machine)
        query = """
            SELECT * FROM (
                SELECT name_machine, force_1, force_2, force_3, force_4, time_update
                FROM glue_force_info
                WHERE name_machine = :machine_name AND line = :line
                ORDER BY time_update DESC
            )
            WHERE ROWNUM <= 30
        """
        cursor.execute(query, {"machine_name": machine_name, "line": line})
    elif type_machine == 'Shielding':
        if machine_name is None and line is None:
            machine_name = 'Machine_6'
            line = 'Line_6'

        minmax = get_min_max_force(line=line, machine_name=machine_name, type_machine=type_machine)
        query = """
            SELECT * FROM (
                SELECT name_machine, force_1, force_2, force_3, force_4, time_update
                FROM Shielding_cover_force_info
                WHERE name_machine = :machine_name AND line = :line
                ORDER BY time_update DESC
            )
            WHERE ROWNUM <= 30
        """
        cursor.execute(query, {"machine_name": machine_name, "line": line})    
    else:
        raise ValueError("Invalid type_machine. Must be 'Screw' or 'Glue' or 'Shielding'.")
    raw_data = cursor.fetchall()
    cursor.close()
    connection.close()
    raw_data = raw_data[::-1]
    time_labels = [row[5].strftime("%H:%M:%S") for row in raw_data]
    series = [
        {"name": "Force 1", "data": [row[1] for row in raw_data]},
        {"name": "Force 2", "data": [row[2] for row in raw_data]},
        {"name": "Force 3", "data": [row[3] for row in raw_data]},
        {"name": "Force 4", "data": [row[4] for row in raw_data]},
    ]

    return {
        "machine_name": raw_data[0][0] if raw_data else None,
        "categories": time_labels,
        "series": series,
        "min_force": minmax["min_force"],
        "max_force": minmax["max_force"]
    }

# get data table
@app.route('/api/dashboard/table', methods=['GET'])
def get_table():
    try:
        page = request.args.get('page', 1, type=int)
        type_machine = request.args.get('type_machine')
        per_page = 10
        rows = get_paginated_data(page, per_page, type_machine)
        total_records = get_total_records(type_machine)
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

#get Limits Force by name_machine and line
@app.route('/api/dashboard/getDefaultForce', methods=['GET'])
def get_default_force():
    try:
        type_machine = request.args.get('type_machine')
        if type_machine == 'Screw':
            query = """
                SELECT LINE, NAME_MACHINE, MIN_FORCE, MAX_FORCE FROM force_default
                WHERE TYPE_MACHINE = 'Screw'
            """
        elif type_machine == 'Glue':
             query = """
                SELECT LINE, NAME_MACHINE, MIN_FORCE, MAX_FORCE FROM force_default
                WHERE TYPE_MACHINE = 'Glue'
            """
        elif type_machine == 'Shielding':
            query = """
                SELECT LINE, NAME_MACHINE, MIN_FORCE, MAX_FORCE FROM force_default
                WHERE TYPE_MACHINE = 'Shielding'
            """
        else:
            raise ValueError("Invalid type_machine. Must be 'Screw' or 'Glue' or 'Shielding'.")
        
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                data = [dict(zip(columns, row)) for row in rows]

                result = {}
                for row in data:
                    key = f"{row['LINE']},{row['NAME_MACHINE']}"
                    result[key] = {
                        "min": row['MIN_FORCE'],
                        "max": row['MAX_FORCE']
                    }

                return jsonify(result)

    except Exception as e:
        print(f"Error fetching: {e}")
        return jsonify({"error": "Unable to fetch"}), 500
#get data All charts
@app.route('/api/dashboard/charts', methods=['GET'])
def get_charts():
    try:
        type_machine = request.args.get('type_machine')
        pie_chart_data = get_pie_chart_data(type_machine)
        column_chart_data = get_column_chart_data(type_machine)
        column2_chart_data = get_column2_chart_data(type_machine)
        data_force_chart = get_data_force_chart(type_machine)
        return jsonify({
            "pie_chart_data": pie_chart_data,
            "column_chart_data": column_chart_data,
            "column2_chart_data": column2_chart_data,
            "data_force_chart": data_force_chart
        })
    except Exception as e:
        app.logger.error(f"Error querying chart data: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/filter', methods=['GET'])
def filter_data():
    try:
        # Lấy các tham số từ request
        line = request.args.get('line') if request.args.get('line') != "null" else None
        factory = request.args.get('factory') if request.args.get('factory') != "null" else None
        nameMachine = request.args.get('nameMachine') if request.args.get('nameMachine') != "null" else None
        model = request.args.get('model') if request.args.get('model') != "null" else None
        time_update = request.args.get('time_update') if request.args.get('time_update') != "null" else None
        time_end = request.args.get('time_end') if request.args.get('time_end') != "null" else None
        state = request.args.get('state') if request.args.get('state') != "null" else None
        type_machine = request.args.get('typeMachine', 'Screw')
        if not type_machine:
            type_machine = 'Screw'
        type_machine_all = type_machine.lower()
        if type_machine_all == 'screw':
            table_name = "Screw_force_info"
        elif type_machine_all == 'glue':
            table_name = "glue_force_info"
        elif type_machine_all == 'shielding':
            table_name = "Shielding_cover_force_info"
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        offset = (page - 1) * per_page

        connection = get_db_connection()
        cursor = connection.cursor()

        # Base query
        base_query = f"""
            SELECT s.factory, s.line, s.name_machine, s.model_name, s.serial_number,
                   s.force_1, s.force_2, s.force_3, s.force_4,
                   TO_CHAR(s.time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update,
                   CASE
                       WHEN (s.force_1 IS NULL OR (d.min_force <= s.force_1 AND s.force_1 <= d.max_force)) AND
                            (s.force_2 IS NULL OR (d.min_force <= s.force_2 AND s.force_2 <= d.max_force)) AND
                            (s.force_3 IS NULL OR (d.min_force <= s.force_3 AND s.force_3 <= d.max_force)) AND
                            (s.force_4 IS NULL OR (d.min_force <= s.force_4 AND s.force_4 <= d.max_force))
                       THEN 'PASS'
                       ELSE 'FAIL'
                   END as state
            FROM {table_name} s
            LEFT JOIN force_default d ON s.line = d.line AND s.name_machine = d.name_machine
            AND d.type_machine = :type_machine
            WHERE 1=1 AND s.time_update IS NOT NULL
        """
        count_query = f"""
            SELECT COUNT(*)
            FROM {table_name} s
            LEFT JOIN force_default d ON s.line = d.line AND s.name_machine = d.name_machine
            AND d.type_machine = :type_machine
            WHERE 1=1 AND s.time_update IS NOT NULL
        """

        params = {}
        params['type_machine'] = type_machine
        if line:
            base_query += " AND UPPER(s.line) = UPPER(:line)"
            count_query += " AND UPPER(s.line) = UPPER(:line)"
            params['line'] = line
        if factory:
            base_query += " AND UPPER(s.factory) = UPPER(:factory)"
            count_query += " AND UPPER(s.factory) = UPPER(:factory)"
            params['factory'] = factory
        if model:
            base_query += " AND UPPER(s.model_name) = UPPER(:model_name)"
            count_query += " AND UPPER(s.model_name) = UPPER(:model_name)"
            params['model_name'] = model
        if nameMachine:
            base_query += " AND UPPER(s.name_machine) = UPPER(:name_machine)"
            count_query += " AND UPPER(s.name_machine) = UPPER(:name_machine)"
            params['name_machine'] = nameMachine
        if time_update and time_end:
            base_query += """
                AND s.time_update BETWEEN TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')
                                    AND TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')
            """
            count_query += """
                AND s.time_update BETWEEN TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')
                                    AND TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')
            """
            params['time_update'] = time_update
            params['time_end'] = time_end
        elif time_update:
            base_query += " AND s.time_update >= TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')"
            count_query += " AND s.time_update >= TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')"
            params['time_update'] = time_update
        elif time_end:
            base_query += " AND s.time_update <= TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')"
            count_query += " AND s.time_update <= TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')"
            params['time_end'] = time_end

        if state:
            if state.upper() == 'PASS':
                state_condition = """
                    AND (
                        (s.force_1 IS NULL OR (d.min_force <= s.force_1 AND s.force_1 <= d.max_force)) AND
                        (s.force_2 IS NULL OR (d.min_force <= s.force_2 AND s.force_2 <= d.max_force)) AND
                        (s.force_3 IS NULL OR (d.min_force <= s.force_3 AND s.force_3 <= d.max_force)) AND
                        (s.force_4 IS NULL OR (d.min_force <= s.force_4 AND s.force_4 <= d.max_force))
                    )
                """
            elif state.upper() == 'FAIL':
                state_condition = """
                    AND (
                        (s.force_1 IS NOT NULL AND (s.force_1 < d.min_force OR s.force_1 > d.max_force)) OR
                        (s.force_2 IS NOT NULL AND (s.force_2 < d.min_force OR s.force_2 > d.max_force)) OR
                        (s.force_3 IS NOT NULL AND (s.force_3 < d.min_force OR s.force_3 > d.max_force)) OR
                        (s.force_4 IS NOT NULL AND (s.force_4 < d.min_force OR s.force_4 > d.max_force))
                    )
                """
            else:
                return jsonify({"success": False, "error": "Invalid state value"}), 400

            base_query += state_condition
            count_query += state_condition

        # Wrap lại phân trang
        upper_bound = offset + per_page
        lower_bound = offset

        paginated_query = f"""
            SELECT * FROM (
                SELECT inner_query.*, ROWNUM AS rnum FROM (
                    {base_query} ORDER BY s.time_update DESC
                ) inner_query
                WHERE ROWNUM <= {upper_bound}
            )
            WHERE rnum > {lower_bound}
        """
        # Thực thi truy vấn chính
        cursor.execute(paginated_query, params)
        rows = cursor.fetchall()

        results = []
        stt = offset + 1
        for row in rows:
            factory, line, machine, model, serial, f1, f2, f3, f4, time_update_str, state_result, _ = row
            results.append({
                'stt': stt,
                'factory': factory,
                'line': line,
                'name_machine': machine,
                'model_name': model,
                'serial_number': serial,
                'force_1': f1,
                'force_2': f2,
                'force_3': f3,
                'force_4': f4,
                'time_update': time_update_str,
                'result': state_result
            })
            stt += 1

        # Lấy tổng số bản ghi
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
        app.logger.error(f"Lỗi khi truy vấn dữ liệu lọc /api/filter: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Đã có lỗi xảy ra khi truy vấn dữ liệu",
            "message": str(e)
        }), 500

# filter charts
@app.route('/api/dashboard/filterCharts', methods=['GET'])
def filter_charts():
    try:
        time_update = request.args.get("time_update")
        time_end = request.args.get("time_end")
        machine_name = request.args.get("nameMachine")
        line = request.args.get("line")
        type_machine = request.args.get("type_machine")
        if time_update and time_end:
            start_date = datetime.strptime(time_update, "%Y-%m-%d %H:%M:%S")
            end_date = datetime.strptime(time_end, "%Y-%m-%d %H:%M:%S")
        else:
            today = datetime.now()
            end_date = today.replace(hour=23, minute=59, second=59, microsecond=0)
            start_date = (end_date - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)

        # Gọi các hàm xử lý dữ liệu
        pie_chart_data = get_pie_chart_data(type_machine,start_date, end_date, line, machine_name )
        column_chart_data = get_column_chart_data(type_machine, start_date, end_date)
        column2_chart_data = get_column2_chart_data(type_machine, start_date, end_date, line, machine_name)
        force_chart_data = get_data_force_chart(type_machine, machine_name, line) if machine_name else None

        return jsonify({
            "success": True,
            "pie_chart_data": pie_chart_data,
            "column_chart_data": column_chart_data,
            "column2_chart_data": column2_chart_data,
            "force_chart_data": force_chart_data
        })
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
                # Thiết lập cookie
                resp.set_cookie('token', access_token, httponly=True, secure=False, max_age=60*60*6, samesite='Lax')
                resp.set_cookie('refresh_token', refresh_token, httponly=True, secure=False, max_age=7*24*60*60, samesite='Lax')                
                return resp
            else:
                return render_template('login.html', error='Incorrect username or password')
        except Exception as e:
            error_message = str(e)
            app.logger.error(f"Login error: {str(e)}")
            return render_template('login.html', error=f"{error_message} Please check backend.")
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
    return render_template('login.html')

#refresh token
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
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours= 6),
            'type' : 'access'
        }, app.config['SECRET_KEY'], algorithm='HS256')
        resp = make_response(jsonify({"message": 'Token refreshed!'}))
        resp.set_cookie('token', new_access_token, httponly=True, secure=True, max_age=60*60*60) #6h
        return resp
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Refresh token has expired"}), 401
    except jwt.InvalidTokenError:
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
                    INSERT INTO USERS (USERNAME, PASSWORD, EMAIL, ROLE)
                    VALUES (:username, :password, :email, 'user')
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
@app.route('/api/getDataComboboxs', methods=['GET'])
def get_lines():
    try:
        type_machine = request.args.get('typeMachine')
        if type_machine == 'Screw':
            query = """
                SELECT 'Line', Line FROM SCREW_FORCE_INFO WHERE LINE IS NOT NULL
                UNION
                SELECT 'NameMachine', NAME_MACHINE FROM SCREW_FORCE_INFO WHERE NAME_MACHINE IS NOT NULL
                UNION
                SELECT 'Factory', FACTORY FROM SCREW_FORCE_INFO WHERE FACTORY IS NOT NULL
                UNION
                SELECT 'ModelName', MODEL_NAME FROM SCREW_FORCE_INFO WHERE MODEL_NAME IS NOT NULL
            """
        elif type_machine == 'Glue':
            query = """
                SELECT 'Line', Line FROM GLUE_FORCE_INFO WHERE LINE IS NOT NULL
                UNION
                SELECT 'NameMachine', NAME_MACHINE FROM GLUE_FORCE_INFO WHERE NAME_MACHINE IS NOT NULL
                UNION
                SELECT 'Factory', FACTORY FROM GLUE_FORCE_INFO WHERE FACTORY IS NOT NULL
                UNION
                SELECT 'ModelName', MODEL_NAME FROM GLUE_FORCE_INFO WHERE MODEL_NAME IS NOT NULL
            """
        elif type_machine == 'Shielding':
            query = """
                SELECT 'Line', Line FROM Shielding_COVER_FORCE_INFO WHERE LINE IS NOT NULL
                UNION
                SELECT 'NameMachine', NAME_MACHINE FROM Shielding_COVER_FORCE_INFO WHERE NAME_MACHINE IS NOT NULL
                UNION
                SELECT 'Factory', FACTORY FROM Shielding_COVER_FORCE_INFO WHERE FACTORY IS NOT NULL
                UNION
                SELECT 'ModelName', MODEL_NAME FROM Shielding_COVER_FORCE_INFO WHERE MODEL_NAME IS NOT NULL
            """
        
        else:
            return jsonify({"error": "Invalid or missing type_machine"}), 400

        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
        result = {"lines": [], "states": ['PASS', 'FAIL'], "nameMachines": [], "factories": [], "modelNames": []}
        for category, value in rows:
            if category == 'Line':
                result["lines"].append(value)

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

@app.route('/api/getCascadingOptions', methods=['GET'])
def get_cascading_options():
    factory = request.args.get('factory')
    model = request.args.get('model_name')
    line = request.args.get('line')
    type_machine= request.args.get('typeMachine')
    query = ""
    params = {}
    if type_machine == 'Screw':
        if factory and not model:
            query = "SELECT DISTINCT MODEL_NAME FROM SCREW_FORCE_INFO WHERE FACTORY = :factory"
            params = {'factory': factory}
        elif factory and model and not line:
            query = "SELECT DISTINCT LINE FROM SCREW_FORCE_INFO WHERE FACTORY = :factory AND MODEL_NAME = :model"
            params = {'factory': factory, 'model': model}
        elif factory and model and line:
            query = "SELECT DISTINCT NAME_MACHINE FROM SCREW_FORCE_INFO WHERE FACTORY = :factory AND MODEL_NAME = :model AND LINE = :line"
            params = {'factory': factory, 'model': model, 'line': line}
        else:
            return jsonify({"error": "Insufficient parameters"}), 400
    elif type_machine == 'Glue':
        if factory and not model:
            query = "SELECT DISTINCT MODEL_NAME FROM GLUE_FORCE_INFO WHERE FACTORY = :factory"
            params = {'factory': factory}
        elif factory and model and not line:
            query = "SELECT DISTINCT LINE FROM GLUE_FORCE_INFO WHERE FACTORY = :factory AND MODEL_NAME = :model"
            params = {'factory': factory, 'model': model}
        elif factory and model and line:
            query = "SELECT DISTINCT NAME_MACHINE FROM GLUE_FORCE_INFO WHERE FACTORY = :factory AND MODEL_NAME = :model AND LINE = :line"
            params = {'factory': factory, 'model': model, 'line': line}
        else:
            return jsonify({"error": "Insufficient parameters"}), 400
    elif type_machine == 'Shielding':
        if factory and not model:
            query = "SELECT DISTINCT MODEL_NAME FROM Shielding_cover_FORCE_INFO WHERE FACTORY = :factory"
            params = {'factory': factory}
        elif factory and model and not line:
            query = "SELECT DISTINCT LINE FROM Shielding_cover_FORCE_INFO WHERE FACTORY = :factory AND MODEL_NAME = :model"
            params = {'factory': factory, 'model': model}
        elif factory and model and line:
            query = "SELECT DISTINCT NAME_MACHINE FROM Shielding_cover_FORCE_INFO WHERE FACTORY = :factory AND MODEL_NAME = :model AND LINE = :line"
            params = {'factory': factory, 'model': model, 'line': line}
        else:
            return jsonify({"error": "Insufficient parameters"}), 400
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall()
        values = [r[0] for r in rows]
        return jsonify(values)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#get total , output, fpy
@app.route('/api/getinfo', methods=['GET'])
def getinfo():
    try:
        end_time = datetime.now()
        start_time = end_time - timedelta(days=30)
        type_machine = request.args.get('type_machine')
        if not type_machine:
            return jsonify({"error": "Missing type_machine parameter"}), 400

        # Tạo câu truy vấn SQL
        base_query = """
            SELECT
                COUNT(*) AS total,
                SUM(
                    CASE
                        WHEN
                            (s.force_1 IS NULL OR (d.min_force <= s.force_1 AND s.force_1 <= d.max_force)) AND
                            (s.force_2 IS NULL OR (d.min_force <= s.force_2 AND s.force_2 <= d.max_force)) AND
                            (s.force_3 IS NULL OR (d.min_force <= s.force_3 AND s.force_3 <= d.max_force)) AND
                            (s.force_4 IS NULL OR (d.min_force <= s.force_4 AND s.force_4 <= d.max_force))
                        THEN 1 ELSE 0
                    END
                ) AS output,
                SUM(
                    CASE
                        WHEN
                            (s.force_1 IS NOT NULL AND (s.force_1 < d.min_force OR s.force_1 > d.max_force)) OR
                            (s.force_2 IS NOT NULL AND (s.force_2 < d.min_force OR s.force_2 > d.max_force)) OR
                            (s.force_3 IS NOT NULL AND (s.force_3 < d.min_force OR s.force_3 > d.max_force)) OR
                            (s.force_4 IS NOT NULL AND (s.force_4 < d.min_force OR s.force_4 > d.max_force))
                        THEN 1 ELSE 0
                    END
                ) AS fail
            FROM {table_name} s
            RIGHT JOIN force_default d
                ON s.line = d.line AND s.name_machine = d.name_machine AND d.type_machine = :type_machine
            WHERE s.time_update IS NOT NULL
              AND s.time_update BETWEEN TO_TIMESTAMP(:start_time, 'YYYY-MM-DD HH24:MI:SS')
                                  AND TO_TIMESTAMP(:end_time, 'YYYY-MM-DD HH24:MI:SS')
        """
        # Xác định tên bảng tương ứng với loại máy
        table_map = {
            'Screw': 'SCREW_FORCE_INFO',
            'Glue': 'GLUE_FORCE_INFO',
            'Shielding': 'SHIELDING_COVER_FORCE_INFO'
        }

        if type_machine not in table_map:
            return jsonify({"error": "Invalid type_machine. Must be 'Screw', 'Glue', or 'Shielding'"}), 400

        query = base_query.format(table_name=table_map[type_machine])

        # Tham số truyền vào SQL
        params = {
            'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
            'end_time': end_time.strftime('%Y-%m-%d %H:%M:%S'),
            'type_machine': type_machine
        }

        # Thực thi truy vấn
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()

        total, output, fail = result
        fpy = (output / total) * 100 if total > 0 else 0

        return jsonify({
            "total": total,
            "output": output,
            "fail": fail,
            "fpy": round(fpy, 2)
        })

    except Exception as e:
        app.logger.error(f"Error querying data: {str(e)}")
        return jsonify({
            "error": "Error querying data",
            "message": str(e)
        }), 500

#get data table by filter
def fetch_filtered_data(filters, type_machine):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Mapping bảng theo loại máy
        table_mapping = {
            'Screw': 'screw_force_info',
            'Glue': 'glue_force_info',
            'Shielding': 'Shielding_cover_force_info'
        }

        if type_machine not in table_mapping:
            raise ValueError(f"Unsupported machine type: {type_machine}")

        table_name = table_mapping[type_machine]
        select_query = f"""
            SELECT s.factory, s.line, s.name_machine, s.model_name, s.serial_number,
                   s.force_1, s.force_2, s.force_3, s.force_4,
                   TO_CHAR(s.time_update, 'YYYY-MM-DD HH24:MI:SS') as time_update,
                   CASE
                       WHEN (s.force_1 IS NULL OR (d.min_force <= s.force_1 AND s.force_1 <= d.max_force)) AND
                            (s.force_2 IS NULL OR (d.min_force <= s.force_2 AND s.force_2 <= d.max_force)) AND
                            (s.force_3 IS NULL OR (d.min_force <= s.force_3 AND s.force_3 <= d.max_force)) AND
                            (s.force_4 IS NULL OR (d.min_force <= s.force_4 AND s.force_4 <= d.max_force))
                       THEN 'PASS'
                       ELSE 'FAIL'
                   END as state
            FROM {table_name} s
            RIGHT JOIN force_default d ON s.line = d.line AND s.name_machine = d.name_machine AND d.type_machine = :type_machine
            WHERE 1=1 AND s.time_update IS NOT NULL
        """

        params = {}
        params['type_machine'] = type_machine
        conditions = []

        def append_condition(field, param_name):
            value = filters.get(param_name)
            if value:
                conditions.append(f"UPPER(s.{field}) = UPPER(:{param_name})")
                params[param_name] = value

        append_condition("line", "line")
        append_condition("factory", "factory")
        append_condition("model_name", "model")
        append_condition("name_machine", "nameMachine")

        if filters.get("time_update") and filters.get("time_end"):
            conditions.append("""
                s.time_update BETWEEN TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')
                                 AND TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')
            """)
            params["time_update"] = filters["time_update"]
            params["time_end"] = filters["time_end"]
        elif filters.get("time_update"):
            conditions.append("s.time_update >= TO_DATE(:time_update, 'YYYY-MM-DD HH24:MI:SS')")
            params["time_update"] = filters["time_update"]
        elif filters.get("time_end"):
            conditions.append("s.time_update <= TO_DATE(:time_end, 'YYYY-MM-DD HH24:MI:SS')")
            params["time_end"] = filters["time_end"]

        if filters.get("state"):
            state = filters["state"].upper()
            if state == "PASS":
                conditions.append("""
                    ( (s.force_1 IS NULL OR (d.min_force <= s.force_1 AND s.force_1 <= d.max_force)) AND
                      (s.force_2 IS NULL OR (d.min_force <= s.force_2 AND s.force_2 <= d.max_force)) AND
                      (s.force_3 IS NULL OR (d.min_force <= s.force_3 AND s.force_3 <= d.max_force)) AND
                      (s.force_4 IS NULL OR (d.min_force <= s.force_4 AND s.force_4 <= d.max_force)) )
                """)
            elif state == "FAIL":
                conditions.append("""
                    ( (s.force_1 IS NOT NULL AND (s.force_1 < d.min_force OR s.force_1 > d.max_force)) OR
                      (s.force_2 IS NOT NULL AND (s.force_2 < d.min_force OR s.force_2 > d.max_force)) OR
                      (s.force_3 IS NOT NULL AND (s.force_3 < d.min_force OR s.force_3 > d.max_force)) OR
                      (s.force_4 IS NOT NULL AND (s.force_4 < d.min_force OR s.force_4 > d.max_force)) )
                """)

        if conditions:
            select_query += " AND " + " AND ".join(conditions)

        select_query += " ORDER BY s.time_update DESC"

        cursor.execute(select_query, params)
        result = cursor.fetchall()

        return result

    except Exception as e:
        app.logger.exception(f"[fetch_filtered_data] Error: {e}")
        raise

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

#download excel
@app.route('/api/downloadExcel', methods=['POST'])
def download_excel():
    try:
        filters = request.json
        type_machine = request.args.get('typeMachine')
        result = fetch_filtered_data( filters, type_machine)
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

@app.route('/api/getDataSolution', methods=['GET'])
def get_data_solution():
    try:
        type_machine = request.args.get('typeMachine')
        if type_machine == 'Screw':
            query = """
                SELECT * FROM force_error WHERE STATUS = 1 and type_machine = 'Screw' ORDER BY ERROR_CODE DESC
            """ 
        elif type_machine == 'Glue':
            query = """
                SELECT * FROM force_error WHERE STATUS = 1 and type_machine = 'Glue' ORDER BY ERROR_CODE DESC
            """
        elif type_machine == 'Shielding':
            query = """
                SELECT * FROM force_error WHERE STATUS = 1 and type_machine = 'Shielding' ORDER BY ERROR_CODE DESC
            """
        
        else:
            raise ValueError("Invalid type_machine. Must be 'Screw' or 'Glue' or 'Shielding'.")
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
        result = []
        for row in rows:
            result.append({
                "error_code": row[0],
                "error_name": row[1],
                "root_cause": row[2],
                "solution": row[3],
                "status": row[4]
            })
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching: {e}")
        return jsonify({"error": "Unable to fetch"}), 500

@app.route('/api/updateDataSolution/<string:id>', methods=['PUT'])
def update_data_solution(id):
    try:
        data = request.json
        error_name = data.get('error_name')
        root_cause = data.get('root_cause')
        solution = data.get('solution')
        if not all([error_name, root_cause, solution]):
            return jsonify({"error": "Missing required fields"}), 400

        query = """
            UPDATE force_error
            SET ERROR_NAME = :error_name, ROOT_CAUSE = :root_cause, SOLUTION = :solution
            WHERE ERROR_CODE = :id
        """
        params = {
            'error_name': error_name,
            'root_cause': root_cause,
            'solution': solution,
            'id': id
        }
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                connection.commit()

        return jsonify({"message": "Solution updated successfully"}), 200

    except Exception as e:
        print(f"Error updating: {e}")
        return jsonify({"error": "Unable to update"}), 500

@app.route('/api/deleteDataSolution/<string:id>', methods=['DELETE'])
def delete_data_solution(id):
    try:
        query = """
            DELETE FROM force_error
            WHERE ERROR_CODE = :id
        """
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, {'id': id})
                connection.commit()

        return jsonify({"message": "Solution deleted successfully"}), 200

    except Exception as e:
        print(f"Error updating: {e}")
        return jsonify({"error": "Unable to update"}), 500

@app.route('/api/addDataSolution', methods=['POST'])
def add_data_soulution():
    try:
        data = request.json
        error_code = data.get('error_code')
        error_name = data.get('error_name')
        root_cause = data.get('root_cause')
        solution = data.get('solution')
        type_machine = data.get('type_machine')
        if not all([error_name, root_cause, solution]):
            return jsonify({"error": "Missing required fields"}), 400
        query = """
            INSERT INTO force_error (ERROR_CODE, ERROR_NAME, ROOT_CAUSE,  SOLUTION, STATUS, TYPE_MACHINE)
            VALUES (:error_code,:error_name, :root_cause, :solution,:status, :type_machine)
        """
        params = {
            'error_code': error_code,
            'error_name': error_name,
            'root_cause': root_cause,
            'solution': solution,
            'status': None,
            'type_machine': type_machine
        }
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                connection.commit()

        return jsonify({"message": "Solution added successfully, waiting for admin approval"}), 200

    except Exception as e:
        print(f"Error updating: {e}")
        return jsonify({"error": "Error code was existed"}), 500

if __name__=='__main__':
    app.run( host='0.0.0.0', debug= True, threaded= 4)
    # serve(app, host="0.0.0.0", port=5000)
#pyinstaller --onefile run.py
#pyinstaller run.spec
