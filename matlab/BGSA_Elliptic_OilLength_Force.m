clear
tic
%% material parameter
w = 12.7e-3;              % width of beam
w_in=19e-3;               % width of insulator
EI=210e9*w*(50e-6)^3/12;  % stiffness of beam
fi_d=pi/2;         % angle of distributed load
fi_t=-pi/2;        % angle of end force
fibo=pi/2;         % angle of force 

e_in = 4.7;        % permittivity of insulator
t_in = 100e-6;     % thickness of insulator
e_di = 2.7;        % permittivity of liquid dielectric
e_air = 1;         % permittivity of air
e_0 = 8.85e-12;    % permittivity of vacuum (Fm-1)
Voltage_different = [0:500:3500, 3600:100:4400, 4500:250:6000, 6500:500:9000];     % actuation voltage

%% calculation
Height_different=10e-3;
Length_total=40e-3;
FF_Voltage=zeros(1,length(Voltage_different));
options = optimoptions('fsolve','Display','off');

parfor n_Voltage=1:length(Voltage_different)
    n_num=50;
    Height=zeros(1,n_num);
    Length_q=0;
    OilLength=(Length_total-Length_q)*0.1;
    % OilLength=2e-3;
    n_node=100;
    n_addnode=0;
    FF=zeros(1,30);
    Height_total=Height_different;
    Voltage = Voltage_different(n_Voltage);
    flag=0;
    for n=1:50
        % tic
        for num=1:n_num % iteration
            Mf=zeros(n_node,n_node);
            Mq=zeros(n_node,n_node);
            Mt=zeros(n_node,n_node);
            theta=zeros(n_node,n_node);
            dtheta=zeros(n_node,n_node);
            %% determine initial force and moment
            if num==1 && n==1      % initial shape
                L=Length_total;
                theta2=0;
                x0=[0.5,0.5,0.1];  % initial value
                B=Height_total/L;  % y position

                x=fsolve(@(x)BeamIntegral(x,B,EI,L,fibo,theta2),x0,options);
                phi1=real(x(1));
                Force=real(x(3));  % End force
                k=cos(fibo/2)/sin(phi1);
                phi2=pi-asin(cos((fibo-theta2)/2)/k);
                F1=ellipticF(phi1,k^2);
                F2=ellipticF(phi2,k^2);
                E1=ellipticE(phi1,k^2);
                E2=ellipticE(phi2,k^2);
                alpha=(F2-F1)^2;
                angle=linspace(phi1,phi2,50);
                W=-1/sqrt(alpha)*(2*k*sin(fibo)*(cos(angle)-cos(phi1)))*L;
                H=-1/sqrt(alpha)*(sin(fibo)*(2*ellipticE(angle,k^2)-2*E1-ellipticF(angle,k^2)+F1))*L;
                S=sqrt(EI/Force)*(ellipticF(angle,k^2)-F1);

                N=find(S>OilLength);
                N=N(1);
                Length_q=S(N);     % Initial length of oil zone
                dl=Length_q/n_node;

                q=zeros(n_node,1);
                F0=Force;
                M0=2*k*sqrt(F0*EI)*cos(phi1)-F0*(W(end)-W(N));

            elseif num==1 && n>1   % Oil move to next position
                q=cat(1,zeros(n_addnode,1),q);
                F0=(Force+F0)/2;
                M0=2*k*sqrt(F0*EI)*cos(phi1)-F0*W(N);
            elseif num==n_num      % reach maximum iteration then stop
                flag=2;
                break
            else                   % iteration calculation
                % q=ones(n_node,1).*0.5*e_di*e_0*w_in*Voltage^2./(2*abs(flip(Y))+2*t_in*e_di/e_in).^2;
                q=ones(n_node,1).*(0.5*e_di*e_0*w*Voltage^2./(2*abs(flip(Y))+2*t_in*e_di/e_in).^2+...
                    e_in*e_0*w*Voltage^2./(2*abs(flip(Y))*e_in/e_di+2*t_in).^2);
                F0=(Force+F0)/2;
                M0=(Moment2+M0)/2;
            end

            %% BGSA
            for i=1:n_node    % number of nodes
                if i==1
                    theta(i,i)=0;
                else
                    Mf(i,i)=F0*dl*sum(sin(fi_t-theta(1:(i-1),i-1)));  % moment of force
                    for m=1:i-1
                        if m==1
                            Mq(i,i)=Mq(i,i)+q(i-m)*dl^2*sin(fi_d-theta(i-1,i-1));          % moment of distributed load produced by previous nodes
                        else
                            Mq(i,i)=Mq(i,i)+q(i-m)*dl^2*sum(sin(fi_d-theta(i-m:i-1,i-1))); % moment of distributed load produced by previous nodes
                        end
                    end
                    Mt(i,i)=M0+Mf(i,i)+Mq(i,i);   % total moment
                    dtheta(i,i)=Mt(i,i)/EI*dl;
                    for j=1:i-1                   % angle correction for previous nodes
                        theta(j,i)=theta(j,i-1)+dtheta(i,i);
                    end
                    if theta(j,i)>0               % limit the upper boundary
                        theta(j,i)=0;
                        theta(:,n_node)=theta(:,i);
                        break
                    end
                end
            end
            X=cumsum(flip(cos(theta(:,n_node))))*dl; % calculation shape of oil-zone
            Y=cumsum(flip(sin(theta(:,n_node))))*dl;

            %% Elliptic Integral
            L=Length_total-Length_q;            % Length of non-oil zone
            Height(num)=Height_total+Y(n_node); % Height of the end tip of non-oil zone
            theta2=-theta(1,n_node);
            x0=[0.5,0.5,0.1];   % initial value
            B=Height(num)/L;    % y position
            [x,fval,exitflag,output]=fsolve(@(x)BeamIntegral(x,B,EI,L,fibo,theta2),x0,options);
            phi1=real(x(1));
            k=cos(fibo/2)/sin(phi1);
            phi2=pi-asin(cos((fibo-theta2)/2)/k);
            if exitflag~=1
                flag=1;
                break
            end
            F1=ellipticF(phi1,k^2);
            F2=ellipticF(phi2,k^2);
            E1=ellipticE(phi1,k^2);
            E2=ellipticE(phi2,k^2);
            alpha=(F2-F1)^2;
            A=real(x(2));       % x position
            Force=real(x(3));   % End force
            Moment1=2*k*sqrt(Force*EI)*cos(phi1);
            Moment2=2*k*sqrt(Force*EI)*cos(phi2);
            if num>1 && abs(1-M0/Moment2)<1e-3 && abs(1-F0/Force)<1e-3 && abs(1-Height(num)/Height(num-1))<1e-3 % if error small enough then stop
                FF(n)=Force*2;  % total force
                break
            end
        end
        % toc
        if flag==1 || flag==2 % if calculation fail or reach maximum iteration then stop
            break
        elseif n>1 && abs(FF(n)/FF(n-1)-1)<0.01 % if force change too small then stop
            flag=3;
            break
        end
        %% calculate shape of non-oil zone
        angle=linspace(phi1,phi2,100);
        W=-1/sqrt(alpha)*(2*k*sin(fibo)*(cos(angle)-cos(phi1)))*L;
        H=-1/sqrt(alpha)*(sin(fibo)*(2*ellipticE(angle,k^2)-2*E1-ellipticF(angle,k^2)+F1))*L;
        S=sqrt(EI/Force)*(ellipticF(angle,k^2)-F1);
        %% calculate the next liquid zone
        OilLength=L*0.03;
        N=find((S(end)*ones(1,length(S))-S)>OilLength);
        N=N(end);
        n_addnode=floor((L-S(N))/dl); % number of adding nodes
        n_node=n_node+n_addnode;      % number of total nodes
        Length_q=n_node*dl;           % Initial length of oil zone
    end
    if flag==1 || flag==2
        FF_Voltage(n_Voltage)=FF(n-1);
    elseif flag==3
        FF_Voltage(n_Voltage)=FF(n);
    end
end
toc
%% plot
figure
plot(Voltage_different,FF_Voltage)
xlabel('Voltage (V)')
ylabel('Contractile force (N)')
title('Voltage - Force')
grid on


% Create simple voltage-force lookup table
LookupTable = [Voltage_different' FF_Voltage'];

% Create table with column headers
LookupTable_Headers = {'Voltage_V', 'Force_N'};
LookupTable_Table = array2table(LookupTable, 'VariableNames', LookupTable_Headers);

% Display lookup table
disp('Voltage-Force Lookup Table:');
disp(LookupTable_Table);

% Save lookup table to CSV file
writetable(LookupTable_Table, 'Voltage_Force_LookupTable1.csv');
fprintf('Voltage-Force lookup table saved to Voltage_Force_LookupTable1.csv\n');
