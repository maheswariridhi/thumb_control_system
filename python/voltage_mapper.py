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

        # Constants for force calculations (in N/rad and meters)
        self.stiffness_dict = {
            "cmc_flexion": 0.15, "cmc_extension": 0.15,
            "cmc_adduction": 0.12, "cmc_abduction": 0.12,
            "mcp_flexion": 0.18, "mcp_extension": 0.18,
            "ip_flexion": 0.16, "ip_extension": 0.16
        }
        
        # Moment arms in meters
        self.moment_arm_dict = {
            "cmc_flexion": 0.015, "cmc_extension": 0.015,
            "cmc_adduction": 0.012, "cmc_abduction": 0.012,
            "mcp_flexion": 0.014, "mcp_extension": 0.014,
            "ip_flexion": 0.013, "ip_extension": 0.013
        }

    def angle_to_force(self, angle, joint):
        """Convert angle to force using stiffness and moment arm"""
        import math
        torque = self.stiffness_dict[joint] * math.radians(angle)
        force = torque / self.moment_arm_dict[joint]
        return max(0, force)  # Ensure force is non-negative

    def angles_to_voltages(self, joint_angles):
        """Convert joint angles to actuator voltages"""
        # Calculate forces for each actuator
        forces = {
            "cmc_flexor": self.angle_to_force(joint_angles.get("CMC_flex", 0) + 0.5 * joint_angles.get("CMC_opp", 0), "cmc_flexion"),
            "cmc_extensor": self.angle_to_force(joint_angles.get("CMC_ext", 0) + 0.5 * joint_angles.get("CMC_rep", 0), "cmc_extension"),
            "cmc_adductor": self.angle_to_force(joint_angles.get("CMC_add", 0) + 0.5 * joint_angles.get("CMC_opp", 0), "cmc_adduction"),
            "cmc_abductor": self.angle_to_force(joint_angles.get("CMC_abd", 0) + 0.5 * joint_angles.get("CMC_rep", 0), "cmc_abduction"),
            "mcp_flexor": self.angle_to_force(joint_angles.get("MCP_flex", 0), "mcp_flexion"),
            "mcp_extensor": self.angle_to_force(joint_angles.get("MCP_ext", 0), "mcp_extension"),
            "ip_flexor": self.angle_to_force(joint_angles.get("IP_flex", 0), "ip_flexion"),
            "ip_extensor": self.angle_to_force(joint_angles.get("IP_ext", 0), "ip_extension")
        }

        # Convert forces to voltages using the lookup table
        voltages = {k: float(self.force_to_voltage(v)) for k, v in forces.items()}
        return voltages
