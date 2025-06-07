def compute_actuator_forces(joint_angles):
    import math

    # Updated constants to match actuator's real force output
    STIFFNESS = {
        "CMC_flex": 0.0131,  # N/rad
        "CMC_ext": 0.0131,
        "CMC_abd": 0.0131,
        "CMC_add": 0.0131,
        "MCP_flex": 0.0131,
        "MCP_ext": 0.0131,
        "IP_flex": 0.0131,
        "IP_ext": 0.0131
    }

    DISTANCE = {
        "CMC_flex": 0.05,  # 5 cm
        "CMC_ext": 0.05,
        "CMC_abd": 0.05,
        "CMC_add": 0.05,
        "MCP_flex": 0.05,
        "MCP_ext": 0.05,
        "IP_flex": 0.05,
        "IP_ext": 0.05
    }

    forces = {k: 0.0 for k in STIFFNESS.keys()}

    # Calculate forces for each actuator
    for joint, angle in joint_angles.items():
        if joint == "CMC_opp":
            # Split force diagonally into CMC_flex + CMC_add
            torque = STIFFNESS["CMC_flex"] * math.radians(angle)
            component_force = torque / DISTANCE["CMC_flex"] * 0.707  # cos(45°)
            forces["CMC_flex"] += component_force
            forces["CMC_add"] += component_force

        elif joint == "CMC_rep":
            # Split force diagonally into CMC_ext + CMC_abd
            torque = STIFFNESS["CMC_ext"] * math.radians(angle)
            component_force = torque / DISTANCE["CMC_ext"] * 0.707  # cos(45°)
            forces["CMC_ext"] += component_force
            forces["CMC_abd"] += component_force

        elif angle != 0 and joint in STIFFNESS:
            # Direct force calculation for other joints
            torque = STIFFNESS[joint] * math.radians(angle)
            force = torque / DISTANCE[joint]
            forces[joint] = max(0, force)  # Ensure non-negative force

    return forces
