#include <bits/stdc++.h>
using namespace std;

int main()
{
    int t;
    cin >> t;
    while (t--)
    {
        int n;
        cin >> n;
        int a[n];
        int count = 0;
        for (int i = 0; i < n; i++)
        {
            cin >> a[i];
        }
        for (int i = 1; i < n; i++)
        {
            if ((a[i - 1] % 2 == 0 && a[i] % 2 == 0) || (a[i - 1] % 2 != 0 && a[i] % 2 != 0))
            {
                a[i - 1] = a[i] * a[i - 1];
                count++;
            }
        }
        cout << count << endl;
    }
}