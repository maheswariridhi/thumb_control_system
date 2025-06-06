function F=BeamIntegral(x,B,EI,L,fibo,theta2)
phi1=x(1);
A=x(2);
R=x(3);

k=cos(fibo/2)/sin(phi1);
% phi2=pi-phi1;
phi2=pi-asin(cos((fibo-theta2)/2)/k);
% phi2=asin(cos((fibo-theta2)/2)/k);

F1=ellipticF(phi1,k^2);
F2=ellipticF(phi2,k^2);
E1=ellipticE(phi1,k^2);
E2=ellipticE(phi2,k^2);
alpha=(F2-F1)^2;

F(1)=-1/sqrt(alpha)*(sin(fibo)*(2*E2-2*E1-F2+F1))-B;
F(2)=-1/sqrt(alpha)*(2*k*sin(fibo)*(cos(phi2)-cos(phi1)))-A;
F(3)=alpha*EI/L^2-R;


