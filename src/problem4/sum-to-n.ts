function sum_to_n_a(n: number): number {
	if (n === 0) {
		return 0;
	}

	if (n === 1) return 1;

	return n + sum_to_n_a(n - 1);
}
// Time Complexity: O(n) - The function makes a recursive call for each value from n down to 1.
// Space Complexity: O(n) - Due to the call stack from recursion.

function sum_to_n_b(n: number): number {
	const sum: number[] = [];

	sum[0] = 0;
	sum[1] = 1;

	for (let i = 2; i <= n; i++) {
		sum[i] = sum[i - 1] + i;
	}

	return sum[n];
}
// Time Complexity: O(n) - The function makes a single pass through the array.
// Space Complexity: O(n) - Due to the array used to store the sum.

function sum_to_n_c(n: number): number {
	return (n * (n + 1)) / 2;
}
// Time Complexity: O(1) - The function performs a single calculation.
// Space Complexity: O(1) - No additional space is used.

console.log(sum_to_n_a(10));
console.log(sum_to_n_b(10));
console.log(sum_to_n_c(10));