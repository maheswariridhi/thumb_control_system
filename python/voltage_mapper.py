import pandas as pd
import numpy as np
from scipy.interpolate import interp1d
class ActuatorVoltageMapper:
    def __init__(self, csv_path: str):
        # Read and sort the CSV data
        self.df = pd.read_csv(csv_path)
        self.force_to_voltage = interp1d(
            self.df["Force_N"], self.df["Voltage_V"],
            kind="linear",
            bounds_error=False,
            fill_value=(self.df["Voltage_V"].min(), self.df["Voltage_V"].max())
        )

    def forces_to_voltages(self, forces):
        """Convert a dictionary of forces to voltages using the lookup table, always mapping 0 force to 0 V"""
        voltages = {}
        for k, v in forces.items():
            if v == 0:
                voltages[k] = 0.0
            else:
                voltages[k] = float(self.force_to_voltage(v))
        return voltages
