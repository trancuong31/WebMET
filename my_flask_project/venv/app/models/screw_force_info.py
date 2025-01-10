import oracledb as db
from datetime import datetime

class ScrewForceInfo(db.Model):
    __tablename__ = 'screw_force_info'
    id = db.Column(db.Integer, primary_key=True)
    line = db.Column(db.String(50), nullable=False)
    name_machine = db.Column(db.String(100), nullable=False)
    force_1 = db.Column(db.Float, nullable=False)
    force_2 = db.Column(db.Float, nullable=False)
    force_3 = db.Column(db.Float, nullable=False)
    force_4 = db.Column(db.Float, nullable=False)
    state = db.Column(db.String(10), nullable=False)
    time_update = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ScrewForceInfo {self.line} - {self.name_machine}>'
