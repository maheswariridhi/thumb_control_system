import pandas as pd
import numpy as np
from scipy.interpolate import interp1d

class ActuatorVoltageMapper:
    def __init__(self, csv_path: str):
        self.df = pd.read_csv(csv_path).sort_values(by="Force_N")
        self.force_to_voltage = interp1d(
            self.df["Force_N"], self.df["Voltage_V"],
            kind="linear",
            bounds_error=False,
            fill_value=(self.df["Voltage_V"].min(), self.df["Voltage_V"].max())
        )

        # Placeholder constants (can be updated per actuator)
        self.stiffness_dict = {
            "cmc_flexion": 0.02, "cmc_extension": 0.02,
            "cmc_adduction": 0.02, "cmc_abduction": 0.02,
            "mcp_flexion": 0.03, "mcp_extension": 0.03,
            "ip_flexion": 0.025, "ip_extension": 0.025
        }
        self.moment_arm_dict = {
            key: 0.01 for key in self.stiffness_dict
        }

    def angle_to_force(self, angle, joint):
        torque = self.stiffness_dict[joint] * angle
        force = torque / self.moment_arm_dict[joint]
        return force

    def angles_to_voltages(self, joint_angles):
        forces = {
            "cmc_flexor": self.angle_to_force(joint_angles.get("cmc_flexion", 0) + 0.5 * joint_angles.get("opposition", 0), "cmc_flexion"),
            "cmc_extensor": self.angle_to_force(joint_angles.get("cmc_extension", 0) + 0.5 * joint_angles.get("reposition", 0), "cmc_extension"),
            "cmc_adductor": self.angle_to_force(joint_angles.get("cmc_adduction", 0) + 0.5 * joint_angles.get("opposition", 0), "cmc_adduction"),
            "cmc_abductor": self.angle_to_force(joint_angles.get("cmc_abduction", 0) + 0.5 * joint_angles.get("reposition", 0), "cmc_abduction"),
            "mcp_flexor": self.angle_to_force(joint_angles.get("mcp_flexion", 0), "mcp_flexion"),
            "mcp_extensor": self.angle_to_force(joint_angles.get("mcp_extension", 0), "mcp_extension"),
            "ip_flexor": self.angle_to_force(joint_angles.get("ip_flexion", 0), "ip_flexion"),
            "ip_extensor": self.angle_to_force(joint_angles.get("ip_extension", 0), "ip_extension")
        }

        voltages = {k: float(self.force_to_voltage(v)) for k, v in forces.items()}
        return voltages
