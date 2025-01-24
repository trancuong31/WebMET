from flask import Flask, request, jsonify, abort, render_template, redirect, flash, send_file, make_response, url_for
import oracledb
from flask_cors import CORS
import jwt, time
from flask_socketio import SocketIO
import os, io
from datetime import datetime, timezone, timedelta
import pandas as pd

app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'
socketio =SocketIO(app)
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
    # token = request.cookies.get('token')
    # if not token:
    #     return redirect(('login'))
    # try:
    #     data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    #     username = data['username']
    # except jwt.ExpiredSignatureError:
    #     flash('Token has expired, please log in again.', 'error')
    #     return redirect(('login'))
    # except jwt.InvalidTokenError:
    #     flash('Invalid token, please log in again.', 'error')
    #     return redirect(('login'))
    # return render_template('index.html', username=username)
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
        connection = get_db_connection()
        cursor = connection.cursor()
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
        
        cursor.execute(query, {"offset": offset, "limit": per_page})
        rows = []
        for row in cursor:
            rows.append({
                'stt': row[0],
                'factory': row[1],
                'line': row[2],
                'serial_number': row[3],
                'model_name': row[4], 
                'name_machine': row[5],
                'force_1': row[6],
                'force_2': row[7],
                'force_3': row[8],
                'force_4': row[9],
                'time_update': row[10],
                'state': row[11]
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

@app.route('/filter', methods=['POST'])
def filter_data():
    try:
        data = request.json
        line = data.get('line') if data.get('line') != "" else None
        factory = data.get('factory') if data.get('factory') != "" else None
        nameMachine = data.get('nameMachine') if data.get('nameMachine') != "" else None
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
                    'exp': datetime.now(timezone.utc) + timedelta(hours=2),
                    'type': 'access'
                }, app.config['SECRET_KEY'], algorithm='HS256')
                refresh_token = jwt.encode({
                    'username': username,
                    'exp': datetime.now(timezone.utc) + timedelta(days=7),
                    'type': 'refresh'
                }, app.config['SECRET_KEY'], algorithm='HS256')
                resp = make_response(redirect(('index1')))
                # Trả về JSON chứa các token
                resp.set_cookie('token', access_token, httponly=True, secure=True, max_age=60*60)
                resp.set_cookie('refresh_token', refresh_token, httponly=True, secure=True, max_age=7*24*60*60)
                return resp
            else:
                return render_template('login.html', error='Incorrect username or password')

        except Exception as e:
             return render_template('login.html', error=f"An error occurred: {e}")

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
 
@app.route('/getLines', methods=['GET'])
def get_lines():
    try:
        query = """
            SELECT 'Line', Line FROM SCREW_FORCE_INFO WHERE LINE IS NOT NULL
            UNION
            SELECT 'State', State FROM SCREW_FORCE_INFO WHERE State IS NOT NULL
            UNION
            SELECT 'NameMachine', NAME_MACHINE FROM SCREW_FORCE_INFO WHERE NAME_MACHINE IS NOT NULL
            UNION
            SELECT 'Factory', FACTORY FROM SCREW_FORCE_INFO WHERE FACTORY IS NOT NULL
        """
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
        result = {"lines": [], "states": [], "nameMachines": [], "factories": []}
        for category, value in rows:
            if category == 'Line':
                result["lines"].append(value)
            elif category == 'State':
                result["states"].append(value)
            elif category == 'NameMachine':
                result["nameMachines"].append(value)
            elif category == 'Factory':
                result["factories"].append(value)

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

def fetch_filtered_data(filters):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            SELECT line, name_machine, force_1, force_2, force_3, force_4, 
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

@app.route('/downloadExcel', methods=['POST'])
def download_excel():
    try:
        filters = request.json
        result = fetch_filtered_data(filters)
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

